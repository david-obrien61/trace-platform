import os
import shutil
import json
import logging
import traceback
import hashlib
import threading
import uuid
import uvicorn
import sys
import io
import csv
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from config import ASSET_DIR, get_api_key, BASE_DIR

api_app = FastAPI()
asset_router = APIRouter(prefix="/api/assets", tags=["Asset Library"])
ui_refresh_callback = None

FILE_HASHES = set()

def build_hash_cache():
    for root, _, files in os.walk(ASSET_DIR):
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                try:
                    with open(os.path.join(root, f), 'rb') as file:
                        FILE_HASHES.add(hashlib.md5(file.read()).hexdigest())
                except: pass
threading.Thread(target=build_hash_cache, daemon=True).start()

def set_ui_callback(callback):
    global ui_refresh_callback
    ui_refresh_callback = callback

@api_app.get("/", response_class=HTMLResponse)
async def get_web_app():
    try:
        if hasattr(sys, '_MEIPASS'):
            html_path = os.path.join(sys._MEIPASS, "upload.html")
        else:
            html_path = os.path.join(BASE_DIR, "upload.html")
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<html><body><h1>upload.html not found!</h1></body></html>"

@asset_router.get("/", response_class=HTMLResponse)
async def get_web_app_router():
    return await get_web_app()

# --- Schema models for API payloads ---
class EditAssetPayload(BaseModel):
    filename: str
    name: str = ""
    location: str = ""
    notes: str = ""

class DeleteAssetPayload(BaseModel):
    filename: str

class RenameAssetPayload(BaseModel):
    filename: str
    new_name: str

class ActionAssetPayload(BaseModel):
    filename: str

# --- Endpoints under APIRouter ---

@asset_router.get("/folders")
async def get_folders():
    try:
        folders = []
        for root_dir, dirs, files in os.walk(ASSET_DIR):
            rel_path = os.path.relpath(root_dir, ASSET_DIR)
            if rel_path != ".":
                folders.append(rel_path.replace("\\", "/"))
        return {"folders": sorted(folders, key=str.lower)}
    except Exception as e:
        logging.error(f"Error fetching folders: {traceback.format_exc()}")
        return {"folders": []}

@asset_router.post("/create_folder")
async def create_folder(
    parent_folder: str = Form(""),
    folder_name: str = Form(...)
):
    try:
        target_dir = ASSET_DIR
        if parent_folder:
            clean_parent = os.path.normpath(parent_folder).lstrip("\\/")
            if not clean_parent.startswith(".."):
                target_dir = os.path.join(ASSET_DIR, clean_parent)
        
        clean_name = os.path.normpath(folder_name).lstrip("\\/")
        if not clean_name.startswith(".."):
            new_folder_path = os.path.join(target_dir, clean_name)
            os.makedirs(new_folder_path, exist_ok=True)
            if ui_refresh_callback:
                ui_refresh_callback()
            return {"message": "Success"}
    except Exception as e:
        logging.error(f"Error creating folder: {traceback.format_exc()}")
        return {"message": "Server Error", "detail": str(e)}

def process_ai_and_metadata(file_path, filename, target_dir, name, location, notes, api_key):
    ai_data = {}
    if api_key:
        logging.info("Starting Gemini AI Analysis...")
        try:
            from google import genai
            from PIL import Image
            client = genai.Client(api_key=api_key)
            img = Image.open(file_path)
            
            prompt = "You are an expert hardware and asset manager. Analyze this image. "
            if name:
                prompt += f"The user provided this identifier/barcode: '{name}'. "
            prompt += (
                "Identify the object and its specifications. "
                "You MUST return your analysis strictly as a JSON object with the following exact keys: "
                "'Brand', 'Model', 'Device_Type', 'Estimated_Value', 'Specs', and 'Summary'. "
                "Do not include any markdown formatting like ```json."
            )
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt, img]
            )
            ai_text = response.text.strip()
            if ai_text.startswith("```json"): ai_text = ai_text[7:]
            elif ai_text.startswith("```"): ai_text = ai_text[3:]
            if ai_text.endswith("```"): ai_text = ai_text[:-3]
            
            try:
                ai_data = json.loads(ai_text.strip())
            except json.JSONDecodeError:
                ai_data = {"Summary": ai_text.strip()}
                
            logging.info("Gemini AI Analysis Successful")
        except Exception as e:
            logging.error(f"AI Analysis Failed: {traceback.format_exc()}")
            ai_data = {"Summary": f"AI Analysis Failed: {e}"}

    # Generate a sidecar text file if any metadata was provided
    if name or location or notes or ai_data:
        txt_filename = f"{os.path.splitext(filename)[0]}_info.txt"
        data_to_save = {
            "Asset_Name": name,
            "Location": location,
            "Notes": notes,
            "AI_Analysis": ai_data
        }
        with open(os.path.join(target_dir, txt_filename), "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, indent=4)
            
    if ui_refresh_callback:
        ui_refresh_callback()

def fetch_live_price_for_item(file_path, filename, target_dir, api_key):
    if not api_key: return
    logging.info(f"Starting live price fetch for {filename}...")
    try:
        from google import genai
        from google.genai import types
        from PIL import Image
        client = genai.Client(api_key=api_key)
        img = Image.open(file_path)
        
        txt_filename = f"{os.path.splitext(filename)[0]}_info.txt"
        txt_path = os.path.join(target_dir, txt_filename)
        
        existing_data = {}
        item_context = ""
        if os.path.exists(txt_path):
            try:
                with open(txt_path, "r", encoding="utf-8") as f:
                    existing_data = json.loads(f.read())
                    name = existing_data.get("Asset_Name", "")
                    brand = existing_data.get("AI_Analysis", {}).get("Brand", "")
                    model = existing_data.get("AI_Analysis", {}).get("Model", "")
                    if name or brand or model:
                        item_context = f"Known details: Name: '{name}', Brand: '{brand}', Model: '{model}'. "
            except: pass
            
        prompt = (
            f"You are an expert appraiser. Look at this image. {item_context}"
            "Search the web to find the current live market price for this exact or highly similar item. "
            "Return ONLY the price as a string (e.g., '$150.00' or '$20.00 - $30.00'). Do not include any other text or markdown."
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}]
            )
        )
        price_text = response.text.strip()
        
        if not existing_data:
            existing_data = {
                "Asset_Name": "",
                "Location": "",
                "Notes": "",
                "AI_Analysis": {"Estimated_Value": price_text}
            }
        else:
            if "AI_Analysis" not in existing_data or not isinstance(existing_data["AI_Analysis"], dict):
                existing_data["AI_Analysis"] = {}
            existing_data["AI_Analysis"]["Estimated_Value"] = price_text
            
        with open(txt_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, indent=4)
                
        logging.info(f"Live Price Fetch Successful for {filename}: {price_text}")
    except Exception as e:
        logging.error(f"Live Price Fetch Failed for {filename}: {traceback.format_exc()}")

@asset_router.post("/upload")
async def upload_asset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(""),
    location: str = Form(""),
    notes: str = Form(""),
    folder: str = Form(""),
    is_last: str = Form("true")
):
    try:
        logging.info(f"Receiving file: {file.filename}")
        ext = os.path.splitext(file.filename)[1]
        unique_id = uuid.uuid4().hex[:6]
        
        if name:
            base_name = name.replace(" ", "_")
        else:
            base_name = os.path.splitext(file.filename)[0].replace(" ", "_")
            
        filename = f"{base_name}_{datetime.now().strftime('%H%M%S')}_{unique_id}{ext}"

        target_dir = ASSET_DIR
        if folder:
            clean_folder = os.path.normpath(folder).lstrip("\\/")
            if not clean_folder.startswith(".."):
                target_dir = os.path.join(ASSET_DIR, clean_folder)
                os.makedirs(target_dir, exist_ok=True)

        file_contents = await file.read()
        file_hash = hashlib.md5(file_contents).hexdigest()
        
        if file_hash in FILE_HASHES:
            logging.info(f"Duplicate file ignored: {file.filename}")
            if ui_refresh_callback and is_last == "true": ui_refresh_callback()
            return {"message": "Duplicate"}
            
        FILE_HASHES.add(file_hash)
        
        file_path = os.path.join(target_dir, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_contents)
            
        api_key = get_api_key()
        background_tasks.add_task(
            process_ai_and_metadata,
            file_path, filename, target_dir, name, location, notes, api_key
        )

        if ui_refresh_callback and is_last == "true":
            ui_refresh_callback()
        
        logging.info(f"Successfully saved {filename}, AI analysis queued.")
        return {"message": "Success"}
    except Exception as e:
        logging.error(f"Critical error during upload routing: {traceback.format_exc()}")
        return {"message": "Server Error", "detail": str(e)}

@asset_router.get("/list")
async def list_assets():
    try:
        assets = []
        for root, dirs, files in os.walk(ASSET_DIR):
            for f in files:
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    file_path = os.path.join(root, f)
                    rel_path = os.path.relpath(file_path, ASSET_DIR).replace("\\", "/")
                    stat = os.stat(file_path)
                    
                    info_data = {}
                    info_path = os.path.join(root, f"{os.path.splitext(f)[0]}_info.txt")
                    if os.path.exists(info_path):
                        try:
                            with open(info_path, "r", encoding="utf-8") as inf:
                                info_data = json.load(inf)
                        except: pass
                        
                    assets.append({
                        "filename": rel_path,
                        "size": stat.st_size,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "name": info_data.get("Asset_Name", ""),
                        "location": info_data.get("Location", ""),
                        "notes": info_data.get("Notes", ""),
                        "ai_analysis": info_data.get("AI_Analysis", {})
                    })
        return {"assets": assets}
    except Exception as e:
        logging.error(f"Error in /list endpoint: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.post("/edit")
async def edit_asset(payload: EditAssetPayload):
    try:
        clean_filename = os.path.normpath(payload.filename).lstrip("\\/")
        if clean_filename.startswith(".."):
            raise HTTPException(status_code=400, detail="Invalid path")
        
        file_path = os.path.join(ASSET_DIR, clean_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        dir_name = os.path.dirname(file_path)
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        info_path = os.path.join(dir_name, f"{base_name}_info.txt")
        
        existing_data = {}
        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except: pass
            
        existing_data["Asset_Name"] = payload.name
        existing_data["Location"] = payload.location
        existing_data["Notes"] = payload.notes
        
        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, indent=4)
            
        if ui_refresh_callback:
            ui_refresh_callback()
        return {"message": "Success"}
    except HTTPException: raise
    except Exception as e:
        logging.error(f"Error in /edit: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.post("/delete")
async def delete_asset(payload: DeleteAssetPayload):
    try:
        clean_filename = os.path.normpath(payload.filename).lstrip("\\/")
        if clean_filename.startswith(".."):
            raise HTTPException(status_code=400, detail="Invalid path")
        
        file_path = os.path.join(ASSET_DIR, clean_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        os.remove(file_path)
        
        dir_name = os.path.dirname(file_path)
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        info_path = os.path.join(dir_name, f"{base_name}_info.txt")
        if os.path.exists(info_path):
            os.remove(info_path)
            
        if ui_refresh_callback:
            ui_refresh_callback()
        return {"message": "Success"}
    except HTTPException: raise
    except Exception as e:
        logging.error(f"Error in /delete: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.post("/rename")
async def rename_asset(payload: RenameAssetPayload):
    try:
        clean_filename = os.path.normpath(payload.filename).lstrip("\\/")
        if clean_filename.startswith("..") or "/" in payload.new_name or "\\" in payload.new_name:
            raise HTTPException(status_code=400, detail="Invalid names")
        
        file_path = os.path.join(ASSET_DIR, clean_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        dir_name = os.path.dirname(file_path)
        ext = os.path.splitext(file_path)[1]
        new_file_path = os.path.join(dir_name, f"{payload.new_name}{ext}")
        
        if os.path.exists(new_file_path):
            raise HTTPException(status_code=400, detail="Destination file already exists")
            
        os.rename(file_path, new_file_path)
        
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        info_path = os.path.join(dir_name, f"{base_name}_info.txt")
        new_info_path = os.path.join(dir_name, f"{payload.new_name}_info.txt")
        if os.path.exists(info_path):
            os.rename(info_path, new_info_path)
            
        if ui_refresh_callback:
            ui_refresh_callback()
            
        new_rel_path = os.path.relpath(new_file_path, ASSET_DIR).replace("\\", "/")
        return {"message": "Success", "new_filename": new_rel_path}
    except HTTPException: raise
    except Exception as e:
        logging.error(f"Error in /rename: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.post("/analyze")
async def analyze_asset(payload: ActionAssetPayload):
    try:
        clean_filename = os.path.normpath(payload.filename).lstrip("\\/")
        if clean_filename.startswith(".."):
            raise HTTPException(status_code=400, detail="Invalid path")
        
        file_path = os.path.join(ASSET_DIR, clean_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        dir_name = os.path.dirname(file_path)
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        info_path = os.path.join(dir_name, f"{base_name}_info.txt")
        
        existing_data = {}
        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except: pass
            
        name = existing_data.get("Asset_Name", "")
        location = existing_data.get("Location", "")
        notes = existing_data.get("Notes", "")
        api_key = get_api_key()
        
        if not api_key:
            raise HTTPException(status_code=400, detail="Gemini API key is not configured")
            
        process_ai_and_metadata(file_path, os.path.basename(file_path), dir_name, name, location, notes, api_key)
        
        new_info_data = {}
        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    new_info_data = json.load(f)
            except: pass
            
        return {"message": "Success", "ai_analysis": new_info_data.get("AI_Analysis", {})}
    except HTTPException: raise
    except Exception as e:
        logging.error(f"Error in /analyze: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.post("/fetch_price")
async def fetch_price(payload: ActionAssetPayload):
    try:
        clean_filename = os.path.normpath(payload.filename).lstrip("\\/")
        if clean_filename.startswith(".."):
            raise HTTPException(status_code=400, detail="Invalid path")
        
        file_path = os.path.join(ASSET_DIR, clean_filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        dir_name = os.path.dirname(file_path)
        api_key = get_api_key()
        if not api_key:
            raise HTTPException(status_code=400, detail="Gemini API key is not configured")
            
        fetch_live_price_for_item(file_path, os.path.basename(file_path), dir_name, api_key)
        
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        info_path = os.path.join(dir_name, f"{base_name}_info.txt")
        new_info_data = {}
        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    new_info_data = json.load(f)
            except: pass
            
        estimated_val = new_info_data.get("AI_Analysis", {}).get("Estimated_Value", "N/A")
        return {"message": "Success", "estimated_value": estimated_val}
    except HTTPException: raise
    except Exception as e:
        logging.error(f"Error in /fetch_price: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.get("/analytics")
async def get_analytics():
    try:
        total_value = 0.0
        item_count = 0
        device_types = {}
        brands = {}
        
        for root, dirs, files in os.walk(ASSET_DIR):
            for f in files:
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    item_count += 1
                    info_path = os.path.join(root, f"{os.path.splitext(f)[0]}_info.txt")
                    if os.path.exists(info_path):
                        try:
                            with open(info_path, "r", encoding="utf-8") as inf:
                                data = json.load(inf)
                                ai = data.get("AI_Analysis", {})
                                dev_type = ai.get("Device_Type", "Unknown") or "Unknown"
                                brand = ai.get("Brand", "Unknown") or "Unknown"
                                
                                device_types[dev_type] = device_types.get(dev_type, 0) + 1
                                brands[brand] = brands.get(brand, 0) + 1
                                
                                val_str = ai.get("Estimated_Value", "")
                                val = parse_price_value(val_str)
                                total_value += val
                        except: pass
        
        return {
            "total_valuation": round(total_value, 2),
            "item_count": item_count,
            "device_types": device_types,
            "brands": brands
        }
    except Exception as e:
        logging.error(f"Error in /analytics: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

def parse_price_value(val_str):
    import re
    if not val_str: return 0.0
    clean_str = val_str.replace(",", "")
    numbers = [float(x) for x in re.findall(r'\d+\.?\d*', clean_str)]
    if not numbers: return 0.0
    if len(numbers) == 1: return numbers[0]
    return sum(numbers) / len(numbers)

@asset_router.get("/export")
async def export_assets():
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Filename", "Asset Name", "Location", "Notes", "Brand", "Model", "Device Type", "Estimated Value", "Summary"])
        
        for root, dirs, files in os.walk(ASSET_DIR):
            for f in files:
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                    rel_path = os.path.relpath(os.path.join(root, f), ASSET_DIR).replace("\\", "/")
                    info_path = os.path.join(root, f"{os.path.splitext(f)[0]}_info.txt")
                    name, loc, notes = "", "", ""
                    brand, model, dev_type, est_val, summary = "", "", "", "", ""
                    
                    if os.path.exists(info_path):
                        try:
                            with open(info_path, "r", encoding="utf-8") as inf:
                                data = json.load(inf)
                                name = data.get("Asset_Name", "")
                                loc = data.get("Location", "")
                                notes = data.get("Notes", "")
                                ai = data.get("AI_Analysis", {})
                                brand = ai.get("Brand", "")
                                model = ai.get("Model", "")
                                dev_type = ai.get("Device_Type", "")
                                est_val = ai.get("Estimated_Value", "")
                                summary = ai.get("Summary", "")
                        except: pass
                        
                    writer.writerow([rel_path, name, loc, notes, brand, model, dev_type, est_val, summary])
                    
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=assets_export.csv"}
        )
    except Exception as e:
        logging.error(f"Error in /export: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@asset_router.post("/backup")
async def backup_assets():
    try:
        backup_dir = os.path.join(BASE_DIR, "backups")
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"assets_backup_{timestamp}"
        zip_path = shutil.make_archive(os.path.join(backup_dir, backup_name), 'zip', ASSET_DIR)
        return {"message": "Success", "backup_file": os.path.basename(zip_path)}
    except Exception as e:
        logging.error(f"Error in /backup: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files to serve raw image assets
api_app.mount("/api/assets/files", StaticFiles(directory=ASSET_DIR), name="asset_files")

# Include the asset APIRouter in the main FastAPI application
api_app.include_router(asset_router)

def start_server():
    try:
        uvicorn.run(api_app, host="0.0.0.0", port=8000, log_level="error")
    except Exception as e:
        logging.error(f"Server startup error (port 8000 occupied?): {e}")