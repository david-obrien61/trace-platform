import os
import json
import csv
import logging
import traceback
import re
import tkinter as tk
from tkinter import messagebox, filedialog, ttk
from datetime import datetime
import shutil
import qrcode
from PIL import Image, ImageTk, ImageDraw
from config import ASSET_DIR

def export_csv(app):
    save_path = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV Files", "*.csv")], title="Export Asset Report", parent=app)
    if not save_path: return
    
    try:
        with open(save_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                "File Name", "Folder", "Date Added", 
                "Asset Name", "Location", "User Notes", 
                "Brand", "Model", "Device Type", "Estimated Value", 
                "Specs", "Summary", "Raw/Old Text"
            ])
            
            for root_dir, dirs, files in os.walk(ASSET_DIR):
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                        rel_folder = os.path.relpath(root_dir, ASSET_DIR)
                        if rel_folder == ".": rel_folder = "Main Library"
                        
                        base, _ = os.path.splitext(file)
                        txt_path = os.path.join(root_dir, f"{base}_info.txt")
                        
                        date_added = datetime.fromtimestamp(os.path.getmtime(os.path.join(root_dir, file))).strftime('%Y-%m-%d %H:%M:%S')
                        
                        if os.path.exists(txt_path):
                            with open(txt_path, "r", encoding="utf-8") as tf:
                                raw_text = tf.read().strip()
                                try:
                                    data = json.loads(raw_text)
                                    ai = data.get("AI_Analysis", {})
                                    writer.writerow([
                                        file, rel_folder, date_added,
                                        data.get("Asset_Name", ""),
                                        data.get("Location", ""),
                                        data.get("Notes", ""),
                                        ai.get("Brand", ""),
                                        ai.get("Model", ""),
                                        ai.get("Device_Type", ""),
                                        ai.get("Estimated_Value", ""),
                                        ai.get("Specs", ""),
                                        ai.get("Summary", ""),
                                        ""
                                    ])
                                except json.JSONDecodeError:
                                    writer.writerow([file, rel_folder, date_added, "", "", "", "", "", "", "", "", "", raw_text])
                        else:
                            writer.writerow([file, rel_folder, date_added, "", "", "", "", "", "", "", "", "", ""])
                            
        messagebox.showinfo("Success", f"Asset report exported successfully to:\n{save_path}", parent=app)
    except Exception as e:
        logging.error(f"Failed to export CSV: {traceback.format_exc()}")
        messagebox.showerror("Error", f"Failed to export CSV: {e}", parent=app)

def backup_library(app):
    save_path = filedialog.asksaveasfilename(
        defaultextension=".zip", 
        filetypes=[("ZIP Archive", "*.zip")], 
        title="Backup Library",
        initialfile=f"Asset_Backup_{datetime.now().strftime('%Y%m%d')}.zip",
        parent=app
    )
    if not save_path: return
    
    try:
        base_path = save_path[:-4] if save_path.endswith('.zip') else save_path
        shutil.make_archive(base_path, 'zip', ASSET_DIR)
        messagebox.showinfo("Success", f"Library backup completed successfully!\nSaved to: {save_path}", parent=app)
    except Exception as e:
        logging.error(f"Backup failed: {traceback.format_exc()}")
        messagebox.showerror("Error", f"Failed to create backup: {e}", parent=app)

def show_analytics(app):
    win = tk.Toplevel(app)
    win.title("Visual Analytics")
    win.geometry("700x500")
    win.configure(bg="#1e1e1e")
    tk.Label(win, text="Asset Value by Category", bg="#1e1e1e", fg="#ffffff", font=("Segoe UI", 14, "bold")).pack(pady=10)
    
    canvas = tk.Canvas(win, bg="#1e1e1e", highlightthickness=0)
    canvas.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
    
    folder_totals = {}
    for root, dirs, files in os.walk(ASSET_DIR):
        folder = os.path.relpath(root, ASSET_DIR)
        if folder == ".": folder = "Main Library"
        folder_totals[folder] = 0.0
        for f in files:
            if f.endswith("_info.txt"):
                try:
                    with open(os.path.join(root, f), 'r', encoding='utf-8') as tf:
                        data = json.loads(tf.read())
                        val_str = str(data.get("AI_Analysis", {}).get("Estimated_Value", "0"))
                        match = re.search(r'\d+(?:\.\d+)?', val_str.replace(',', ''))
                        if match: folder_totals[folder] += float(match.group())
                except: pass
                
    colors = ["#ff9999", "#66b3ff", "#99ff99", "#ffcc99", "#c2c2f0", "#ffb3e6", "#ff6666", "#c2f0c2"]
    total = sum(folder_totals.values())
    if total == 0:
        canvas.create_text(350, 200, text="No estimated values found.", fill="white", font=("Segoe UI", 12))
        return
        
    start_angle = 0
    y_offset = 50
    for i, (folder, val) in enumerate(sorted(folder_totals.items(), key=lambda x: x[1], reverse=True)):
        if val == 0: continue
        extent = (val / total) * 360
        color = colors[i % len(colors)]
        canvas.create_arc(50, 50, 350, 350, start=start_angle, extent=extent, fill=color, outline="#1e1e1e")
        start_angle += extent
        
        canvas.create_rectangle(400, y_offset, 420, y_offset+20, fill=color, outline="#1e1e1e")
        canvas.create_text(430, y_offset+10, text=f"{folder}: ${val:,.2f}", fill="white", anchor=tk.W, font=("Segoe UI", 10))
        y_offset += 30

def generate_qr_label(app):
    if not app.current_selected_path: return
    
    path = app.current_selected_path
    base, _ = os.path.splitext(path)
    txt_path = f"{base}_info.txt"
    
    asset_name = os.path.basename(base)
    if os.path.exists(txt_path):
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                data = json.loads(f.read())
                if data.get("Asset_Name"):
                    asset_name = data.get("Asset_Name")
        except: pass
        
    try:
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(asset_name)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
        
        width, height = qr_img.size
        label_img = Image.new("RGB", (width, height + 40), "white")
        label_img.paste(qr_img, (0, 0))
        
        draw = ImageDraw.Draw(label_img)
        text_width = len(asset_name) * 6 
        x_pos = max(0, (width - text_width) // 2)
        draw.text((x_pos, height + 5), asset_name, fill="black")
        
        safe_filename = "".join([c for c in asset_name if c.isalpha() or c.isdigit() or c == ' ']).rstrip()
        safe_filename = safe_filename.replace(' ', '_')
        if not safe_filename: safe_filename = "Asset"
        
        save_path = filedialog.asksaveasfilename(
            defaultextension=".png", filetypes=[("PNG Image", "*.png")], 
            title="Save QR Label", initialfile=f"QR_{safe_filename}.png",
            parent=app
        )
        if save_path:
            label_img.save(save_path)
            messagebox.showinfo("Success", "QR Label saved successfully!\nIt will now open so you can print it.", parent=app)
            os.startfile(save_path)
    except Exception as e:
        logging.error(f"Failed to generate QR label: {traceback.format_exc()}")
        messagebox.showerror("Error", f"Failed to generate QR label: {e}", parent=app)

def annotate_image(app):
    if not app.current_selected_path: return
    path = app.current_selected_path
    if not path.lower().endswith(('.png', '.jpg', '.jpeg')): return
    
    win = tk.Toplevel(app)
    win.title("Annotate Image")
    win.configure(bg="#111111")
    
    img = Image.open(path)
    orig_w, orig_h = img.size
    img.thumbnail((800, 600))
    scale_x = orig_w / img.width
    scale_y = orig_h / img.height
    tk_img = ImageTk.PhotoImage(img)
    
    canvas = tk.Canvas(win, width=img.width, height=img.height, bg="#111111", highlightthickness=0)
    canvas.pack(padx=10, pady=10)
    canvas.create_image(0, 0, anchor=tk.NW, image=tk_img)
    canvas.image = tk_img 
    
    start_x, start_y = None, None
    rect_id = None
    rects = []
    
    def on_press(event):
        nonlocal start_x, start_y, rect_id
        start_x, start_y = canvas.canvasx(event.x), canvas.canvasy(event.y)
        rect_id = canvas.create_rectangle(start_x, start_y, start_x, start_y, outline="red", width=3)
        
    def on_drag(event):
        cur_x, cur_y = canvas.canvasx(event.x), canvas.canvasy(event.y)
        canvas.coords(rect_id, start_x, start_y, cur_x, cur_y)
        
    def on_release(event):
        cur_x, cur_y = canvas.canvasx(event.x), canvas.canvasy(event.y)
        rects.append((start_x, start_y, cur_x, cur_y))
        
    canvas.bind("<ButtonPress-1>", on_press)
    canvas.bind("<B1-Motion>", on_drag)
    canvas.bind("<ButtonRelease-1>", on_release)
    
    def save_and_close():
        full_img = Image.open(path)
        draw = ImageDraw.Draw(full_img)
        for r in rects:
            scaled_r = (r[0]*scale_x, r[1]*scale_y, r[2]*scale_x, r[3]*scale_y)
            draw.rectangle(scaled_r, outline="red", width=int(3*scale_x) or 3)
        full_img.save(path)
        win.destroy()
        app.load_images(app.current_filter_type, app.current_filter_value)
        app.update_details_pane(path)
        
    ttk.Button(win, text="Save Annotations", command=save_and_close).pack(pady=10)

def edit_properties(app):
    if not app.current_selected_path: return
    path = app.current_selected_path
    base, _ = os.path.splitext(path)
    txt_path = f"{base}_info.txt"
    
    data = {"Asset_Name": "", "Location": "", "Notes": "", "AI_Analysis": {}}
    if os.path.exists(txt_path):
        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                data = json.loads(f.read())
        except:
            with open(txt_path, "r", encoding="utf-8") as f:
                raw_text = f.read().strip()
            
            asset_name = ""
            location = ""
            if "Asset Name:" in raw_text:
                asset_name = raw_text.split("Asset Name:")[1].split("\n")[0].strip()
            if "Location:" in raw_text:
                location = raw_text.split("Location:")[1].split("\n")[0].strip()
            
            data = {"Asset_Name": asset_name, "Location": location, "Notes": "", "AI_Analysis": {"Summary": raw_text}}
        
    ai = data.get("AI_Analysis", {})
    if not isinstance(ai, dict): ai = {"Summary": str(ai)}
    
    edit_win = tk.Toplevel(app)
    edit_win.title("Edit Properties")
    edit_win.geometry("400x500")
    edit_win.configure(bg="#1e1e1e")
    
    fields = [
        ("Asset Name", data.get("Asset_Name", "")),
        ("Location", data.get("Location", "")),
        ("Brand", ai.get("Brand", "")),
        ("Model", ai.get("Model", "")),
        ("Estimated Value", ai.get("Estimated_Value", "")),
    ]
    
    entries = {}
    for i, (label_text, val) in enumerate(fields):
        tk.Label(edit_win, text=label_text, bg="#1e1e1e", fg="#fff").pack(anchor=tk.W, padx=10, pady=(10, 0))
        entry = ttk.Entry(edit_win)
        entry.pack(fill=tk.X, padx=10, pady=2)
        entry.insert(0, str(val))
        entries[label_text] = entry
        
    tk.Label(edit_win, text="Notes", bg="#1e1e1e", fg="#fff").pack(anchor=tk.W, padx=10, pady=(10, 0))
    notes_text = tk.Text(edit_win, height=4, font=("Segoe UI", 10), bg="#333", fg="#fff")
    notes_text.pack(fill=tk.X, padx=10, pady=2)
    notes_text.insert(tk.END, data.get("Notes", ""))
    
    def save_props():
        data["Asset_Name"] = entries["Asset Name"].get()
        data["Location"] = entries["Location"].get()
        data["Notes"] = notes_text.get(1.0, tk.END).strip()
        
        ai["Brand"] = entries["Brand"].get()
        ai["Model"] = entries["Model"].get()
        ai["Estimated_Value"] = entries["Estimated Value"].get()
        data["AI_Analysis"] = ai
        
        with open(txt_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
            
        edit_win.destroy()
        app.load_images(app.current_filter_type, app.current_filter_value)
        app.update_details_pane(path)
        
    ttk.Button(edit_win, text="Save Changes", command=save_props).pack(pady=20)