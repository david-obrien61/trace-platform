import os
import shutil
import subprocess
import tkinter as tk
from tkinter import simpledialog, messagebox
from PIL import Image
from config import ASSET_DIR

def create_folder(app):
    folder_name = simpledialog.askstring("New Folder", "Enter folder name:", parent=app)
    if folder_name:
        target_dir = ASSET_DIR
        if app.current_filter_type == "folder" and app.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, app.current_filter_value)
        os.makedirs(os.path.join(target_dir, folder_name), exist_ok=True)
        app.load_images(app.current_filter_type, app.current_filter_value, force_tree_refresh=True)

def copy_folder_path(app):
    target_dir = ASSET_DIR
    if app.current_filter_type == "folder" and app.current_filter_value:
        target_dir = os.path.join(ASSET_DIR, app.current_filter_value)
    abs_path = os.path.abspath(target_dir)
    app.clipboard_clear()
    app.clipboard_append(abs_path)
    app.update()

def rename_folder(app):
    if app.current_filter_type == "folder" and app.current_filter_value:
        target_dir = os.path.join(ASSET_DIR, app.current_filter_value)
        base_name = os.path.basename(target_dir)
        new_name = simpledialog.askstring("Rename Folder", "Enter new name:", initialvalue=base_name, parent=app)
        if new_name and new_name != base_name:
            parent_dir = os.path.dirname(target_dir)
            new_path = os.path.join(parent_dir, new_name)
            os.rename(target_dir, new_path)
            
            new_rel = os.path.relpath(new_path, ASSET_DIR).replace("\\", "/")
            if new_rel == ".": new_rel = ""
            app.load_images("folder", new_rel, force_tree_refresh=True)
    elif app.current_filter_type == "folder" and not app.current_filter_value:
        messagebox.showwarning("Notice", "You cannot rename the Main Library root folder.", parent=app)

def open_current_folder_in_explorer(app):
    target_dir = ASSET_DIR
    if app.current_filter_type == "folder" and app.current_filter_value:
        target_dir = os.path.join(ASSET_DIR, app.current_filter_value)
    os.startfile(os.path.abspath(target_dir))

def delete_folder(app):
    if app.current_filter_type == "folder" and app.current_filter_value:
        target_dir = os.path.join(ASSET_DIR, app.current_filter_value)
        msg = f"Are you sure you want to delete '{os.path.basename(target_dir)}'?\n\nWARNING: This will permanently delete everything in this folder, including all pictures and subfolders!"
        if messagebox.askyesno("Delete Folder", msg, icon="warning", parent=app):
            shutil.rmtree(target_dir, ignore_errors=True)
            app.load_images("folder", "", force_tree_refresh=True)
    elif app.current_filter_type == "folder" and not app.current_filter_value:
        messagebox.showwarning("Notice", "You cannot delete the Main Library root folder.", parent=app)

def create_text_file(app):
    file_name = simpledialog.askstring("New Text File", "Enter file name:", parent=app)
    if file_name:
        if not file_name.endswith(".txt"): file_name += ".txt"
        target_dir = ASSET_DIR
        if app.current_filter_type == "folder" and app.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, app.current_filter_value)
        path = os.path.join(target_dir, file_name)
        with open(path, "w") as f: f.write("Enter notes here...")
        os.startfile(path)
        app.load_images(app.current_filter_type, app.current_filter_value)

def open_with_item(app):
    if app.current_selected_path:
        subprocess.Popen(["rundll32", "shell32.dll,OpenAs_RunDLL", os.path.normpath(app.current_selected_path)])

def copy_item(app):
    if app.current_selected_path:
        dir_name = os.path.dirname(app.current_selected_path)
        base_name = os.path.basename(app.current_selected_path)
        name, ext = os.path.splitext(base_name)
        new_name = simpledialog.askstring("Copy", "Enter name for the copy:", initialvalue=f"{name}_copy{ext}", parent=app)
        if new_name:
            shutil.copy(app.current_selected_path, os.path.join(dir_name, new_name))
            txt_path = f"{name}_info.txt"
            new_txt_path = f"{os.path.splitext(new_name)[0]}_info.txt"
            if os.path.exists(os.path.join(dir_name, txt_path)):
                shutil.copy(os.path.join(dir_name, txt_path), os.path.join(dir_name, new_txt_path))
            app.load_images(app.current_filter_type, app.current_filter_value)

def rename_item(app):
    if app.current_selected_path:
        dir_name = os.path.dirname(app.current_selected_path)
        base_name = os.path.basename(app.current_selected_path)
        new_name = simpledialog.askstring("Rename", "Enter new name:", initialvalue=base_name, parent=app)
        if new_name and new_name != base_name:
            os.rename(app.current_selected_path, os.path.join(dir_name, new_name))
            txt_path = f"{os.path.splitext(base_name)[0]}_info.txt"
            new_txt_path = f"{os.path.splitext(new_name)[0]}_info.txt"
            if os.path.exists(os.path.join(dir_name, txt_path)):
                os.rename(os.path.join(dir_name, txt_path), os.path.join(dir_name, new_txt_path))
            app.load_images(app.current_filter_type, app.current_filter_value)

def rotate_image(app):
    if not app.current_selected_path: return
    if not app.current_selected_path.lower().endswith(('.png', '.jpg', '.jpeg')):
        messagebox.showinfo("Notice", "Only images can be rotated.", parent=app)
        return
        
    try:
        img = Image.open(app.current_selected_path)
        img = img.rotate(-90, expand=True)
        img.save(app.current_selected_path)
        app.load_images(app.current_filter_type, app.current_filter_value)
        app.update_details_pane(app.current_selected_path)
    except Exception as e:
        messagebox.showerror("Error", f"Failed to rotate image: {e}", parent=app)

def delete_item(app):
    if not app.selected_paths: return
    msg = f"Are you sure you want to delete {len(app.selected_paths)} item(s)?"
    if len(app.selected_paths) == 1:
        msg = f"Are you sure you want to delete {os.path.basename(list(app.selected_paths)[0])}?"
    if messagebox.askyesno("Delete", msg, parent=app):
        for path in app.selected_paths:
            try: 
                os.remove(path)
                base, _ = os.path.splitext(path)
                txt_path = f"{base}_info.txt"
                if os.path.exists(txt_path): os.remove(txt_path)
            except: pass
        app.selected_paths.clear()
        app.current_selected_path = None
        app.update_details_pane(None)
        app.load_images(app.current_filter_type, app.current_filter_value)