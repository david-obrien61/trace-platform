import logging
import threading
from server import start_server, set_ui_callback
from ui import AssetDashboard

def main():
    logging.info("Application initialized in modular component mode...")
    
    # Initialize the Tkinter User Interface
    app = AssetDashboard()
    
    # Connect the API server's UI refresh trigger to the Tkinter schedule_refresh method
    set_ui_callback(lambda: app.after(0, app.schedule_refresh))
    
    # Start the local web server in the background
    threading.Thread(target=start_server, daemon=True).start()
    
    # Run the desktop application loop
    app.mainloop()

if __name__ == "__main__":
    main()
