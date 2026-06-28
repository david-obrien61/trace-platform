import os
import json
import threading
from tkinter import messagebox
from config import get_api_key

def batch_ai_process(app):
    api_key = get_api_key()
    if not api_key:
        messagebox.showwarning("API Key Missing", "Please set your Gemini API Key first.", parent=app)
        return
        
    paths = [p for p in app.selected_paths if p.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not paths: return
    
    def worker():
        from server import process_ai_and_metadata
        for path in paths:
            target_dir = os.path.dirname(path)
            filename = os.path.basename(path)
            base = os.path.splitext(filename)[0]
            txt_path = os.path.join(target_dir, f"{base}_info.txt")
            
            name, loc, notes = "", "", ""
            if os.path.exists(txt_path):
                try:
                    with open(txt_path, "r", encoding="utf-8") as f:
                        data = json.loads(f.read())
                        name = data.get("Asset_Name", "")
                        loc = data.get("Location", "")
                        notes = data.get("Notes", "")
                except: pass
            
            processing = [True]
            def fake_progress(current_path):
                import time
                p = 0.0
                while processing[0] and p < 95:
                    app.after(0, app.set_item_progress, current_path, p, "Reviewing")
                    time.sleep(0.2)
                    p += (95 - p) * 0.1
                    
            threading.Thread(target=fake_progress, args=(path,), daemon=True).start()
            
            try:
                process_ai_and_metadata(path, filename, target_dir, name, loc, notes, api_key)
            finally:
                processing[0] = False
                app.after(0, app.set_item_progress, path, 100, "Done!")
            
        app.after(0, app.schedule_refresh)
        app.after(0, lambda: messagebox.showinfo("Batch Complete", f"Finished AI Analysis for {len(paths)} items!", parent=app))

    threading.Thread(target=worker, daemon=True).start()
    messagebox.showinfo("Started", f"Queued {len(paths)} items for AI re-analysis in the background. The dashboard will refresh when done.", parent=app)

def batch_fetch_price(app):
    api_key = get_api_key()
    if not api_key:
        messagebox.showwarning("API Key Missing", "Please set your Gemini API Key first.", parent=app)
        return
        
    paths = [p for p in app.selected_paths if p.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not paths: return
    
    def worker():
        from server import fetch_live_price_for_item
        for path in paths:
            target_dir = os.path.dirname(path)
            filename = os.path.basename(path)
            
            processing = [True]
            def fake_progress(current_path):
                import time
                p = 0.0
                while processing[0] and p < 95:
                    app.after(0, app.set_item_progress, current_path, p, "Fetching")
                    time.sleep(0.2)
                    p += (95 - p) * 0.1
                    
            threading.Thread(target=fake_progress, args=(path,), daemon=True).start()
            
            try:
                fetch_live_price_for_item(path, filename, target_dir, api_key)
            finally:
                processing[0] = False
                app.after(0, app.set_item_progress, path, 100, "Done!")
            
        app.after(0, app.schedule_refresh)
        app.after(0, lambda: messagebox.showinfo("Price Fetch Complete", f"Finished fetching live prices for {len(paths)} items!", parent=app))

    threading.Thread(target=worker, daemon=True).start()
    messagebox.showinfo("Started", f"Queued {len(paths)} items for live price check in the background. The dashboard will refresh when done.", parent=app)