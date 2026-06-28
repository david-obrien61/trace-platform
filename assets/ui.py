import os
import shutil
import json
import logging
import traceback
import csv
import subprocess
import threading
import tkinter as tk
from tkinter import messagebox, ttk, filedialog, simpledialog
from datetime import datetime
import qrcode
import re
from PIL import Image, ImageTk, ImageDraw

from config import ASSET_DIR, get_api_key, set_api_key, get_local_ip
from ui_file_ops import (create_folder, copy_folder_path, rename_folder, 
                         open_current_folder_in_explorer, delete_folder, 
                         create_text_file, open_with_item, copy_item, 
                         rename_item, delete_item, rotate_image)
from ui_tools import (export_csv, backup_library, show_analytics, 
                      generate_qr_label, annotate_image, edit_properties)
from ui_ai import batch_ai_process, batch_fetch_price

class AssetDashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Raw Element Asset Library")
        self.geometry("1000x700")
        
        self.image_refs = [] # Keeps thumbnail images in memory
        self.sort_order = "Date (Newest)"
        self.current_filter_type = None
        self.current_filter_value = None
        self._drag_data = None
        self.tooltip = None
        self._refresh_timer = None
        self.current_selected_path = None
        self.search_var = tk.StringVar()
        self.current_max_cols = 5
        self._resize_timer = None
        self.view_mode = "grid"
        self.selected_paths = set()
        self.status_var = tk.StringVar()
        self.item_progress_bars = {}
        
        self.apply_dark_theme()
        self.setup_ui()
        self.load_images()
        
    def schedule_refresh(self):
        if self._refresh_timer:
            self.after_cancel(self._refresh_timer)
        self._refresh_timer = self.after(500, self._do_refresh)
        
    def _do_refresh(self):
        self.load_images(self.current_filter_type, self.current_filter_value, force_tree_refresh=True)
        
    def apply_dark_theme(self):
        self.configure(bg="#111111")
        style = ttk.Style(self)
        style.theme_use("clam")
        
        default_font = ("Segoe UI", 10)
        style.configure(".", font=default_font, background="#111111", foreground="#ffffff")
        style.configure("TFrame", background="#111111")
        style.configure("TButton", background="#2d2d30", foreground="#ffffff", borderwidth=1, focuscolor="none")
        style.map("TButton", background=[("active", "#3e3e42")])
        
        style.configure("Treeview", background="#181818", fieldbackground="#181818", foreground="#ffffff", borderwidth=0)
        style.map("Treeview", background=[("selected", "#094771")], foreground=[("selected", "#ffffff")])
        style.configure("Treeview.Heading", background="#252526", foreground="#ffffff", borderwidth=1, font=("Segoe UI", 10, "bold"))
        
        style.configure("TPanedwindow", background="#111111")
        style.configure("TMenubutton", background="#2d2d30", foreground="#ffffff", borderwidth=1, padding=5)
        style.map("TMenubutton", background=[("active", "#3e3e42")])
        
        style.configure("TEntry", foreground="#000000")

    def setup_ui(self):
        self._setup_toolbar()
        self.paned_window = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True)
        
        # Bottom Status Bar
        status_bar = tk.Label(self, textvariable=self.status_var, bg="#007acc", fg="#ffffff", anchor=tk.W, font=("Segoe UI", 9), padx=10, pady=2)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        self._setup_sidebar()
        self._setup_center_gallery()
        self._setup_details_pane()
        self._setup_context_menus()

    def _setup_toolbar(self):
        # Top Toolbar
        toolbar = tk.Frame(self, bd=0, bg="#1e1e1e")
        toolbar.pack(side=tk.TOP, fill=tk.X)
        
        import_btn = ttk.Button(toolbar, text="Import Pictures", command=self.import_pictures)
        import_btn.pack(side=tk.LEFT, padx=5, pady=5)
        
        open_folder_btn = ttk.Button(toolbar, text="Open Folder in Windows", command=lambda: os.startfile(os.path.abspath(ASSET_DIR)))
        open_folder_btn.pack(side=tk.LEFT, padx=5, pady=5)

        ai_btn = ttk.Button(toolbar, text="🤖 Set AI Key", command=self.prompt_api_key)
        ai_btn.pack(side=tk.LEFT, padx=5, pady=5)

        export_btn = ttk.Button(toolbar, text="📄 Export to CSV", command=lambda: export_csv(self))
        export_btn.pack(side=tk.LEFT, padx=5, pady=5)
        
        backup_btn = ttk.Button(toolbar, text="💾 Backup Library", command=lambda: backup_library(self))
        backup_btn.pack(side=tk.LEFT, padx=5, pady=5)
        
        analytics_btn = ttk.Button(toolbar, text="📊 Analytics", command=lambda: show_analytics(self))
        analytics_btn.pack(side=tk.LEFT, padx=5, pady=5)
        
        price_btn = ttk.Button(toolbar, text="💰 Fetch Live Price", command=lambda: batch_fetch_price(self))
        price_btn.pack(side=tk.LEFT, padx=5, pady=5)

        tk.Label(toolbar, text="Search (or price>100):", bg="#1e1e1e", fg="#ffffff").pack(side=tk.LEFT, padx=(15, 2))
        self.search_var.trace("w", lambda name, index, mode: self.schedule_refresh())
        search_entry = ttk.Entry(toolbar, textvariable=self.search_var, width=25)
        search_entry.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.view_btn = ttk.Button(toolbar, text="🔲 View: Grid", command=self.toggle_view)
        self.view_btn.pack(side=tk.LEFT, padx=5, pady=5)

        self.sort_btn = ttk.Menubutton(toolbar, text=f"Sort: {self.sort_order} ▾")
        self.sort_btn.pack(side=tk.LEFT, padx=5, pady=5)
        sort_menu = tk.Menu(self.sort_btn, tearoff=0, bg="#252526", fg="#ffffff", font=("Segoe UI", 9), activebackground="#094771")
        self.sort_btn["menu"] = sort_menu
        
        for option in ["Date (Newest)", "Date (Oldest)", "Name (A-Z)", "Name (Z-A)"]:
            sort_menu.add_command(label=option, command=lambda o=option: self.change_sort(o))
            
    def _setup_sidebar(self):
        # Left Sidebar (Treeview)
        left_frame = ttk.Frame(self.paned_window, width=250)
        self.paned_window.add(left_frame, weight=1)
        
        tree_frame = ttk.Frame(left_frame)
        tree_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        self.tree_scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL)
        self.tree = ttk.Treeview(tree_frame, yscrollcommand=self.tree_scrollbar.set)
        self.tree_scrollbar.configure(command=self.tree.yview)
        
        self.tree_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.tree.heading("#0", text="Library", anchor=tk.W)
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        
        qr_frame = tk.Frame(left_frame, bg="#181818", pady=10)
        qr_frame.pack(side=tk.BOTTOM, fill=tk.X)
        
        try:
            ip_addr = get_local_ip()
            url = f"http://{ip_addr}:8000/api/assets/"
            qr = qrcode.QRCode(version=1, box_size=4, border=1)
            qr.add_data(url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            self.qr_photo = ImageTk.PhotoImage(qr_img)
            
            tk.Label(qr_frame, image=self.qr_photo, bg="#181818").pack()
            tk.Label(qr_frame, text="Scan to Upload", bg="#181818", fg="#d4d4d4", font=("Segoe UI", 9, "bold")).pack(pady=(5,0))
        except Exception as e:
            logging.error(f"QR Generation Error: {traceback.format_exc()}")
            
        # Sidebar Tooltip and Context Menu Triggers
        self.tree.bind("<Motion>", self.check_tooltip)
        self.tree.bind("<Leave>", self.hide_tooltip)
        self.tree.bind("<Button-3>", self.show_sidebar_menu)
        
    def _setup_center_gallery(self):
        # Center Content Area (Gallery & List)
        self.center_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(self.center_frame, weight=4)
        
        self.canvas = tk.Canvas(self.center_frame, bg="#111111", highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self.center_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        self.gallery_frame = tk.Frame(self.canvas, bg="#111111")
        
        self.gallery_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        
        self.canvas.create_window((0, 0), window=self.gallery_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        
        # List View Setup
        self.list_tree_scroll = ttk.Scrollbar(self.center_frame, orient=tk.VERTICAL)
        self.list_tree = ttk.Treeview(self.center_frame, columns=("Name", "Brand", "Location", "Price", "Date"), show="headings", yscrollcommand=self.list_tree_scroll.set)
        self.list_tree_scroll.configure(command=self.list_tree.yview)
        
        for col in self.list_tree["columns"]:
            self.list_tree.heading(col, text=col, command=lambda c=col: self.sort_list_tree(c))
            self.list_tree.column(col, width=120)
            
        self.list_tree.bind("<<TreeviewSelect>>", self.on_list_select)
        self.list_tree.bind("<Button-3>", self.show_item_menu_list)
        self.list_tree.bind("<Double-1>", lambda e: self.open_file(self.current_selected_path))

        self.show_current_view()
        
        # Dynamic resizing for wrapping gallery
        self.canvas.bind("<Configure>", self.on_canvas_resize)
        
        # Enable Mousewheel Scrolling for Gallery
        self.canvas.bind('<Enter>', lambda e: self.canvas.bind_all("<MouseWheel>", self._on_mousewheel))
        self.canvas.bind('<Leave>', lambda e: self.canvas.unbind_all("<MouseWheel>"))
        
        self.canvas.bind("<Button-3>", self.show_gallery_menu)
        self.gallery_frame.bind("<Button-3>", self.show_gallery_menu)
        
    def _setup_details_pane(self):
        # Right Details Pane
        self.details_frame = tk.Frame(self.paned_window, bg="#181818", width=250)
        self.paned_window.add(self.details_frame, weight=1)
        
        self.details_img_label = tk.Label(self.details_frame, bg="#181818")
        self.details_img_label.pack(pady=10)
        
        self.details_info = tk.Text(self.details_frame, bg="#181818", fg="#ffffff", font=("Segoe UI", 9), wrap=tk.WORD, bd=0)
        self.details_info.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        self.details_info.insert(tk.END, "Select an item to view details.")
        self.details_info.config(state=tk.DISABLED)

    def _setup_context_menus(self):
        # Sidebar Context Menu
        self.sidebar_menu = tk.Menu(self, tearoff=0, bg="#252526", fg="#ffffff")
        self.sidebar_menu.add_command(label="Open in File Explorer", command=lambda: open_current_folder_in_explorer(self))
        self.sidebar_menu.add_separator()
        self.sidebar_menu.add_command(label="New Folder", command=lambda: create_folder(self))
        self.sidebar_menu.add_command(label="Copy Path", command=lambda: copy_folder_path(self))
        self.sidebar_menu.add_separator()
        self.sidebar_menu.add_command(label="Rename", command=lambda: rename_folder(self))
        self.sidebar_menu.add_command(label="Delete", command=lambda: delete_folder(self))
        
        # Gallery Context Menu
        self.gallery_menu = tk.Menu(self, tearoff=0, bg="#252526", fg="#ffffff")
        self.sort_submenu = tk.Menu(self.gallery_menu, tearoff=0, bg="#252526", fg="#ffffff")
        for option in ["Date (Newest)", "Date (Oldest)", "Name (A-Z)", "Name (Z-A)"]:
            self.sort_submenu.add_command(label=option, command=lambda o=option: self.change_sort(o))
        self.gallery_menu.add_cascade(label="Sort by", menu=self.sort_submenu)
        self.gallery_menu.add_command(label="Refresh", command=lambda: self.load_images(self.current_filter_type, self.current_filter_value, force_tree_refresh=True))
        self.gallery_menu.add_separator()
        self.new_submenu = tk.Menu(self.gallery_menu, tearoff=0, bg="#252526", fg="#ffffff")
        self.new_submenu.add_command(label="Folder", command=lambda: create_folder(self))
        self.new_submenu.add_command(label="Text Document", command=lambda: create_text_file(self))
        self.gallery_menu.add_cascade(label="New", menu=self.new_submenu)
        self.gallery_menu.add_separator()
        self.gallery_menu.add_command(label="Open in File Explorer", command=lambda: open_current_folder_in_explorer(self))
        
        # Item Context Menu
        self.item_menu = tk.Menu(self, tearoff=0, bg="#252526", fg="#ffffff")
        self.item_menu.add_command(label="Open", command=lambda: open_with_item(self))
        self.item_menu.add_command(label="Edit Properties", command=lambda: edit_properties(self))
        self.item_menu.add_separator()
        self.item_menu.add_command(label="Copy", command=lambda: copy_item(self))
        self.item_menu.add_separator()
        self.item_menu.add_command(label="Rotate 90°", command=lambda: rotate_image(self))
        self.item_menu.add_command(label="✏️ Annotate Image", command=lambda: annotate_image(self))
        self.item_menu.add_command(label="Generate QR Label", command=lambda: generate_qr_label(self))
        self.item_menu.add_separator()
        self.item_menu.add_command(label="🤖 Re-Analyze with AI", command=lambda: batch_ai_process(self))
        self.item_menu.add_command(label="💰 Fetch Live Price", command=lambda: batch_fetch_price(self))
        self.item_menu.add_separator()
        self.item_menu.add_command(label="Rename", command=lambda: rename_item(self))
        self.item_menu.add_command(label="Delete", command=lambda: delete_item(self))
        
    def on_canvas_resize(self, event):
        # Debounce the resize event to prevent UI lag while actively dragging the window
        if self._resize_timer:
            self.after_cancel(self._resize_timer)
        self._resize_timer = self.after(100, lambda: self.rearrange_gallery(event.width))
        
    def toggle_view(self):
        self.view_mode = "list" if self.view_mode == "grid" else "grid"
        self.view_btn.configure(text="🔲 View: Grid" if self.view_mode == "grid" else "📄 View: List")
        self.show_current_view()
        self.load_images(self.current_filter_type, self.current_filter_value)

    def show_current_view(self):
        self.canvas.pack_forget()
        self.scrollbar.pack_forget()
        self.list_tree.pack_forget()
        self.list_tree_scroll.pack_forget()
        
        if self.view_mode == "grid":
            self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        else:
            self.list_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            self.list_tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def sort_list_tree(self, col):
        l = [(self.list_tree.set(k, col), k) for k in self.list_tree.get_children('')]
        try:
            if col == "Price":
                def get_price(val):
                    match = re.search(r'\d+(?:\.\d+)?', str(val).replace(',', ''))
                    return float(match.group()) if match else 0.0
                l.sort(key=lambda t: get_price(t[0]), reverse=True)
            elif col == "Date":
                l.sort(key=lambda t: t[0], reverse=True)
            else:
                l.sort(key=lambda t: t[0].lower())
        except:
            l.sort(key=lambda t: t[0].lower())
        for index, (val, k) in enumerate(l):
            self.list_tree.move(k, '', index)

    def set_item_progress(self, path, percent, text=""):
        if path in self.item_progress_bars:
            widgets = self.item_progress_bars[path]
            if percent >= 0:
                if not widgets["pb"].winfo_ismapped() and self.view_mode == "grid":
                    widgets["pb"].pack(side=tk.BOTTOM, fill=tk.X, padx=5, pady=2, before=widgets["lbl_txt"])
                    widgets["lbl_percent"].pack(side=tk.BOTTOM, fill=tk.X, before=widgets["pb"])
                widgets["pb_var"].set(percent)
                widgets["lbl_percent"].config(text=f"{text} {int(percent)}%")
            else:
                widgets["pb"].pack_forget()
                widgets["lbl_percent"].pack_forget()
                
        if self.view_mode == "list":
            for item in self.list_tree.get_children():
                if self.list_tree.item(item, "tags") and self.list_tree.item(item, "tags")[0] == path:
                    orig_val = self.list_tree.set(item, "Name")
                    orig_val = re.sub(r' \[.*? \d+%\]| \[Done!\]', '', orig_val)
                    self.list_tree.set(item, "Name", f"{orig_val} [{text} {int(percent)}%]" if 0 <= percent < 100 else (f"{orig_val} [Done!]" if percent == 100 else orig_val))

    def show_item_menu_list(self, event):
        item = self.list_tree.identify_row(event.y)
        if item:
            if item not in self.list_tree.selection():
                self.list_tree.selection_set(item)
            self.on_list_select(None)
            self.item_menu.post(event.x_root, event.y_root)

    def handle_press(self, event, path, tile=None):
        self.select_item(event, path, tile)
        self.start_drag(event, path)

    def select_item(self, event, path, tile=None):
        if event and (event.state & 0x0004): # Ctrl is pressed
            if path in self.selected_paths:
                self.selected_paths.remove(path)
                if tile: tile.config(bg="#1e1e1e")
            else:
                self.selected_paths.add(path)
                if tile: tile.config(bg="#094771")
        else:
            self.selected_paths = {path}
            if self.view_mode == "grid":
                for widget in self.gallery_frame.winfo_children():
                    widget.config(bg="#1e1e1e")
            if tile: tile.config(bg="#094771")
            
        self.current_selected_path = path if self.selected_paths else None
        self.update_details_pane(self.current_selected_path)

    def on_list_select(self, event):
        selected = self.list_tree.selection()
        self.selected_paths.clear()
        for item in selected:
            tags = self.list_tree.item(item, "tags")
            if tags:
                self.selected_paths.add(tags[0])
                self.current_selected_path = tags[0]
                
        if self.current_selected_path:
            self.update_details_pane(self.current_selected_path)

    def update_details_pane(self, path):
        if not path or not os.path.exists(path):
            self.details_img_label.config(image="")
            self.details_info.config(state=tk.NORMAL)
            self.details_info.delete(1.0, tk.END)
            self.details_info.insert(tk.END, "Select an item to view details.")
            self.details_info.config(state=tk.DISABLED)
            return
            
        try:
            img = Image.open(path)
            img.thumbnail((230, 230))
            photo = ImageTk.PhotoImage(img)
            self.details_img_label.config(image=photo)
            self.details_img_label.image = photo 
            
            base, _ = os.path.splitext(path)
            txt_path = f"{base}_info.txt"
            info_text = f"File: {os.path.basename(path)}\n\n"
            
            if os.path.exists(txt_path):
                with open(txt_path, "r", encoding="utf-8") as f:
                    try:
                        data = json.loads(f.read())
                        info_text += f"Name: {data.get('Asset_Name', '')}\n"
                        info_text += f"Location: {data.get('Location', '')}\n"
                        info_text += f"Notes: {data.get('Notes', '')}\n\n"
                        
                        ai = data.get("AI_Analysis", {})
                        if isinstance(ai, dict):
                            info_text += f"Brand: {ai.get('Brand', '')}\n"
                            info_text += f"Model: {ai.get('Model', '')}\n"
                            info_text += f"Type: {ai.get('Device_Type', '')}\n"
                            info_text += f"Value: {ai.get('Estimated_Value', '')}\n\n"
                            info_text += f"Summary:\n{ai.get('Summary', '')}\n"
                    except:
                        f.seek(0)
                        info_text += f"Raw Info:\n{f.read()}\n"
            
            self.details_info.config(state=tk.NORMAL)
            self.details_info.delete(1.0, tk.END)
            self.details_info.insert(tk.END, info_text)
            self.details_info.config(state=tk.DISABLED)
        except Exception as e: pass
        
    def rearrange_gallery(self, width=None):
        if width is None:
            width = self.canvas.winfo_width()
            
        if width > 10:
            # Image (150px) + Label Pad (16px) + Grid Pad (20px) = 186px minimum width per item. We use 190px for safety.
            self.current_max_cols = max(1, width // 190)
            
        for i, widget in enumerate(self.gallery_frame.winfo_children()):
            widget.grid(row=(i // self.current_max_cols), column=(i % self.current_max_cols), padx=10, pady=10)
            
    def load_images(self, filter_type=None, filter_value=None, force_tree_refresh=False):
        try:
            self.current_filter_type = filter_type
            self.current_filter_value = filter_value
            
            # Clear current gallery tiles
            for widget in self.gallery_frame.winfo_children():
                widget.destroy()
            self.list_tree.delete(*self.list_tree.get_children())
            self.image_refs.clear()
            self.item_progress_bars.clear()
            
            # Scan directories
            folders_dict = {}
            all_paths = []
            
            for root_dir, dirs, files in os.walk(ASSET_DIR):
                rel_path = os.path.relpath(root_dir, ASSET_DIR).replace("\\", "/")
                if rel_path == ".":
                    rel_path = ""
                    
                if rel_path not in folders_dict:
                    folders_dict[rel_path] = []
                    
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.txt')):
                        path = os.path.join(root_dir, file)
                        all_paths.append(path)
                        folders_dict[rel_path].append(path)
            
            # Update Sidebar
            if not filter_type or force_tree_refresh:
                self.tree.delete(*self.tree.get_children())
                
                folder_root = self.tree.insert("", "end", text="📁 Main Library", open=True, values=("folder", ""))
                node_map = {"": folder_root}
                
                for folder in sorted(folders_dict.keys(), key=str.lower):
                    if not folder: continue
                    parts = folder.split("/")
                    current_path = ""
                    parent_path = ""
                    
                    for part in parts:
                        if current_path:
                            parent_path = current_path
                            current_path = current_path + "/" + part
                        else:
                            current_path = part
                            
                        if current_path not in node_map:
                            node_map[current_path] = self.tree.insert(
                                node_map[parent_path], "end", text=f"┗ 📁 {part}", values=("folder", current_path), open=True
                            )
                
                target_val = self.current_filter_value if self.current_filter_type == "folder" else ""
                found = False
                for item in node_map.values():
                    if self.tree.item(item, "values") and self.tree.item(item, "values")[1] == target_val:
                        self.tree.selection_set(item)
                        found = True
                        break
                if not found:
                    self.tree.selection_set(folder_root)

            # Determine which pictures to show
            display_paths = []
            if filter_type == "folder":
                if filter_value == "":
                    display_paths = all_paths
                else:
                    display_paths = folders_dict.get(filter_value, [])
            else:
                # Show all if root is clicked
                display_paths = all_paths

            # Apply Sorting
            if self.sort_order == "Date (Newest)":
                display_paths.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            elif self.sort_order == "Date (Oldest)":
                display_paths.sort(key=lambda x: os.path.getmtime(x))
            elif self.sort_order == "Name (A-Z)":
                display_paths.sort(key=lambda x: os.path.basename(x).lower())
            elif self.sort_order == "Name (Z-A)":
                display_paths.sort(key=lambda x: os.path.basename(x).lower(), reverse=True)

            # Apply Search Filter
            search_query = self.search_var.get().lower()
            price_gt = None
            if "price>" in search_query:
                try: 
                    price_gt = float(search_query.split("price>")[1].split()[0])
                    search_query = search_query.replace(f"price>{search_query.split('price>')[1].split()[0]}", "").strip()
                except: pass

            if search_query or price_gt is not None:
                filtered_paths = []
                for path in display_paths:
                    base, ext = os.path.splitext(path)
                    txt_path = f"{base}_info.txt" if ext != '.txt' else path
                    
                    text_content = ""
                    data = {}
                    if os.path.exists(txt_path):
                        try:
                            with open(txt_path, "r", encoding="utf-8") as f:
                                text_content = f.read().lower()
                                f.seek(0)
                                data = json.loads(f.read())
                        except Exception: pass
                        
                    if price_gt is not None:
                        val_str = str(data.get("AI_Analysis", {}).get("Estimated_Value", "0"))
                        match = re.search(r'\d+(?:\.\d+)?', val_str.replace(',', ''))
                        try:
                            if not match or float(match.group()) <= price_gt:
                                continue
                        except: continue

                    if search_query:
                        if search_query not in os.path.basename(path).lower() and search_query not in text_content:
                            continue
                            
                    filtered_paths.append(path)
                display_paths = filtered_paths

            # Status bar calculations
            item_count = 0
            total_value = 0.0

            # Create Thumbnail Tiles
            for path in display_paths:
                try:
                    if path.lower().endswith(".txt"):
                        continue # Skip rendering raw txt files in the gallery now, keep it clean
                    else:
                        item_count += 1
                        img = Image.open(path)
                        img.thumbnail((150, 150))
                        
                        # Try to read the associated value from the JSON sidecar
                        base, _ = os.path.splitext(path)
                        txt_path = f"{base}_info.txt"
                        if os.path.exists(txt_path):
                            with open(txt_path, "r", encoding="utf-8") as f:
                                try:
                                    data = json.loads(f.read())
                                    val_str = str(data.get("AI_Analysis", {}).get("Estimated_Value", "0"))
                                    # Strip out "$", commas, and text to get a raw float
                                    clean_val = re.sub(r'[^\d.]', '', val_str)
                                    if clean_val:
                                        total_value += float(clean_val)
                                except: pass
                                
                    photo = ImageTk.PhotoImage(img)
                    self.image_refs.append(photo)
                    
                    # Create the tile
                    tile = tk.Frame(self.gallery_frame, bg="#1e1e1e", bd=0)
                    # Grid placement will happen natively in rearrange_gallery
                    
                    lbl_img = tk.Label(tile, image=photo, bg="#1e1e1e", cursor="hand2")
                    lbl_img.pack(padx=8, pady=(8, 4))
                    
                    # Bind Context menu, Drag-and-Drop, and Double-Click Opening
                    lbl_img.bind("<Button-3>", lambda e, p=path: self.show_item_menu(e, p))
                    lbl_img.bind("<ButtonPress-1>", lambda e, p=path: self.start_drag(e, p))
                    lbl_img.bind("<ButtonRelease-1>", self.stop_drag)
                    lbl_img.bind("<Double-1>", lambda e, p=path: self.open_file(p))
                    
                    name = os.path.basename(path)
                    # Truncate long names
                    if len(name) > 18: name = name[:15] + "..."
                    lbl_txt = tk.Label(tile, text=name, bg="#1e1e1e", fg="#ffffff", font=("Segoe UI", 9))
                    lbl_txt.pack(side=tk.BOTTOM, fill=tk.X, pady=(0, 8))
                    lbl_txt.bind("<Button-3>", lambda e, p=path: self.show_item_menu(e, p))
                    
                except Exception as e:
                    logging.error(f"Error rendering thumbnail for {path}: {e}")
                    
            self.rearrange_gallery()
            
            # Update status bar text
            self.status_var.set(f"{item_count} Items  |  Estimated Total Value: ${total_value:,.2f}")
            
            if self.current_selected_path:
                self.update_details_pane(self.current_selected_path)
            
        except Exception as e:
            logging.error(f"Critical error loading gallery UI: {traceback.format_exc()}")
            messagebox.showerror("UI Error", "An error occurred while loading the gallery. Check the debug log.")

    def change_sort(self, order):
        self.sort_order = order
        self.sort_btn.configure(text=f"Sort: {order} ▾")
        self.load_images(self.current_filter_type, self.current_filter_value)
        
    def open_file(self, path):
        try: os.startfile(path)
        except Exception as e: print(f"Error opening: {e}")

    def on_tree_select(self, event):
        selected = self.tree.selection()
        if selected:
            item = self.tree.item(selected[0])
            if item["values"]:
                self.load_images(filter_type=item["values"][0], filter_value=item["values"][1])
            else:
                self.load_images()
                
    def import_pictures(self):
        file_paths = filedialog.askopenfilenames(title="Select Pictures", filetypes=[("Image Files", "*.png *.jpg *.jpeg *.gif")])
        if not file_paths: return
        
        api_key = get_api_key()
        target_dir = ASSET_DIR
        if self.current_filter_type == "folder" and self.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
            
        def worker():
            from server import process_ai_and_metadata, FILE_HASHES
            import hashlib
            
            for path in file_paths:
                with open(path, "rb") as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
                    
                if file_hash in FILE_HASHES:
                    continue # Skip duplicates silently
                    
                FILE_HASHES.add(file_hash)
                filename = os.path.basename(path)
                dest_path = os.path.join(target_dir, filename)
                shutil.copy(path, dest_path)
                
                process_ai_and_metadata(dest_path, filename, target_dir, "", "", "", api_key)
                
            self.after(0, self.schedule_refresh)
            
        threading.Thread(target=worker, daemon=True).start()
        
    def check_tooltip(self, event):
        if self.tree.identify_region(event.x, event.y) == "heading":
            if not self.tooltip:
                self.show_tooltip(event.x_root + 10, event.y_root + 10, os.path.abspath(ASSET_DIR))
        else:
            self.hide_tooltip()

    def show_tooltip(self, x, y, text):
        self.tooltip = tk.Toplevel(self)
        self.tooltip.wm_overrideredirect(True)
        self.tooltip.wm_geometry(f"+{x}+{y}")
        tk.Label(self.tooltip, text=text, bg="#2d2d30", fg="#ffffff", relief="solid", bd=1, padx=5, pady=2).pack()

    def hide_tooltip(self, event=None):
        if self.tooltip:
            self.tooltip.destroy()
            self.tooltip = None
            
    def show_sidebar_menu(self, event):
        item = self.tree.identify_row(event.y)
        if item:
            self.tree.selection_set(item)
            self.on_tree_select(None)
        else:
            children = self.tree.get_children()
            if children:
                self.tree.selection_set(children[0])
                self.on_tree_select(None)
        self.sidebar_menu.post(event.x_root, event.y_root)
        
    def show_gallery_menu(self, event):
        self.gallery_menu.post(event.x_root, event.y_root)
        
    def create_folder(self):
        folder_name = simpledialog.askstring("New Folder", "Enter folder name:")
        if folder_name:
            target_dir = ASSET_DIR
            if self.current_filter_type == "folder" and self.current_filter_value:
                target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
            os.makedirs(os.path.join(target_dir, folder_name), exist_ok=True)
            self.load_images(self.current_filter_type, self.current_filter_value, force_tree_refresh=True)
            
    def copy_folder_path(self):
        target_dir = ASSET_DIR
        if self.current_filter_type == "folder" and self.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
        abs_path = os.path.abspath(target_dir)
        self.clipboard_clear()
        self.clipboard_append(abs_path)
        self.update()

    def rename_folder(self):
        if self.current_filter_type == "folder" and self.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
            base_name = os.path.basename(target_dir)
            new_name = simpledialog.askstring("Rename Folder", "Enter new name:", initialvalue=base_name)
            if new_name and new_name != base_name:
                parent_dir = os.path.dirname(target_dir)
                new_path = os.path.join(parent_dir, new_name)
                os.rename(target_dir, new_path)
                
                new_rel = os.path.relpath(new_path, ASSET_DIR).replace("\\", "/")
                if new_rel == ".": new_rel = ""
                self.load_images("folder", new_rel, force_tree_refresh=True)
        elif self.current_filter_type == "folder" and not self.current_filter_value:
            messagebox.showwarning("Notice", "You cannot rename the Main Library root folder.")

    def open_current_folder_in_explorer(self):
        target_dir = ASSET_DIR
        if self.current_filter_type == "folder" and self.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
        os.startfile(os.path.abspath(target_dir))

    def delete_folder(self):
        if self.current_filter_type == "folder" and self.current_filter_value:
            target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
            msg = f"Are you sure you want to delete '{os.path.basename(target_dir)}'?\n\nWARNING: This will permanently delete everything in this folder, including all pictures and subfolders!"
            if messagebox.askyesno("Delete Folder", msg, icon="warning"):
                shutil.rmtree(target_dir, ignore_errors=True)
                self.load_images("folder", "", force_tree_refresh=True)
        elif self.current_filter_type == "folder" and not self.current_filter_value:
            messagebox.showwarning("Notice", "You cannot delete the Main Library root folder.")

    def create_text_file(self):
        file_name = simpledialog.askstring("New Text File", "Enter file name:")
        if file_name:
            if not file_name.endswith(".txt"): file_name += ".txt"
            target_dir = ASSET_DIR
            if self.current_filter_type == "folder" and self.current_filter_value:
                target_dir = os.path.join(ASSET_DIR, self.current_filter_value)
            path = os.path.join(target_dir, file_name)
            with open(path, "w") as f: f.write("Enter notes here...")
            os.startfile(path)
            self.load_images(self.current_filter_type, self.current_filter_value)

    def show_item_menu(self, event, path):
        self.current_selected_path = path
        self.item_menu.post(event.x_root, event.y_root)
    def start_drag(self, event, path):
        if path not in self.selected_paths:
            self.select_item(event, path)
        self._drag_data = {"paths": list(self.selected_paths)}
        
    def stop_drag(self, event):
        if not self._drag_data: return
        widget = self.winfo_containing(event.x_root, event.y_root)
        if widget == self.tree:
            item = self.tree.identify_row(event.y_root - self.tree.winfo_rooty())
            if item and self.tree.item(item, "values") and self.tree.item(item, "values")[0] == "folder":
                dest = os.path.join(ASSET_DIR, self.tree.item(item, "values")[1])
                for p in self._drag_data["paths"]:
                    if os.path.abspath(os.path.dirname(p)) != os.path.abspath(dest):
                        shutil.move(p, dest)
                        base, _ = os.path.splitext(p)
                        txt_path = f"{base}_info.txt"
                        if os.path.exists(txt_path):
                            shutil.move(txt_path, dest)
                self.selected_paths.clear()
                self.update_details_pane(None)
                self.load_images(self.current_filter_type, self.current_filter_value)
        self._drag_data = None

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")


    def prompt_api_key(self):
        current_key = get_api_key()
        new_key = simpledialog.askstring("Gemini API Key", "Enter your Gemini API Key:", initialvalue=current_key)
        if new_key is not None:
            set_api_key(new_key)
            messagebox.showinfo("Success", "API Key saved! Future uploads will be automatically analyzed by Gemini.")