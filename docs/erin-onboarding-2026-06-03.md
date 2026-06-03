# Erin's Developer Setup Guide
**Created:** 2026-06-03  
**For:** Erin O'Brien — first-time setup on Mac  
**Estimated time:** 1–2 hours (with breaks)

---

## Before you start

This document walks you through setting up everything you need to work on the TRACE platform on your Mac. You'll end up with:

- VS Code (the app where you write and edit code)
- Claude Code (your AI co-writer, lives inside VS Code)
- A GitHub account (your developer identity — how code is shared and saved)
- The trace-platform project on your computer, ready to open and edit

You don't need to know how to code before starting this. You just need to follow the steps in order.

**Who to ask for help:**
- **Andrew** — if something isn't installing, a command isn't working, or VS Code is behaving strangely
- **Connor** — if something about your Mac's setup seems deeper (network issues, permissions, system stuff)
- **David** — if you have questions about what you're building or what scope your project has

It's completely normal to get stuck. Getting stuck and asking is faster than trying to figure everything out alone.

---

## Step 1 — Install VS Code

**What VS Code is:** It's the program where you write and edit code. Think of it like Word, but for code. It shows you files, lets you edit them, and has tools that help you while you work.

1. Go to **https://code.visualstudio.com** in your browser
2. Click the big blue **Download for Mac** button
3. The download is a `.zip` file — find it in your Downloads folder
4. Double-click the `.zip` file to unzip it. A file called `Visual Studio Code` appears.
5. Drag `Visual Studio Code` into your **Applications** folder (the same way you'd move any app)
6. Open it from your Applications folder or Launchpad

**What you should see:** A dark welcome screen with some options. That's normal — VS Code is ready.

**One more step — add a shortcut for later:** With VS Code open, press **Cmd+Shift+P** to open the command bar. Type `Shell Command` and click **"Shell Command: Install 'code' command in PATH"** when it appears. This lets you open VS Code from the Terminal later with a shortcut. Click OK if it asks for permission.

---

## Step 2 — Install Apple's Command Line Tools

**What this is:** Apple includes a hidden set of developer tools that other software needs to run. They're not installed by default — you have to trigger the install once, and then they stay forever.

1. Find and open **Terminal** on your Mac
   - Press **Cmd+Space** to open Spotlight search
   - Type `Terminal` and press Enter
   - A window opens with a text prompt — this is the Terminal
   
2. In the Terminal window, type this exactly and press Enter:
   ```
   xcode-select --install
   ```

3. A dialog box pops up asking if you want to install. Click **Install** (not "Get Xcode").

4. Wait. This downloads about 3 GB and takes **10–30 minutes** depending on your internet. The progress bar will be slow. That's normal. Don't close the window.

5. When it finishes, **verify it worked** — type this in Terminal and press Enter:
   ```
   git --version
   ```
   You should see something like `git version 2.39.0`. Any version number means it worked. If you see an error, ask Andrew.

---

## Step 3 — Check if Homebrew is installed (or install it)

**What Homebrew is:** It's a tool that installs other developer tools. Think of it like the App Store, but for command-line tools. You'll use it to install a couple things in the next steps.

**Check if it's already there:**
In Terminal, type this and press Enter:
```
brew --version
```

- **If you see a version number** (like `Homebrew 4.x.x`): Homebrew is already installed. Skip to Step 4.
- **If you see "command not found"**: It's not installed. Keep reading.

**To install Homebrew:**
1. Go to **https://brew.sh** in your browser
2. You'll see a command that starts with `/bin/bash -c ...` — copy it exactly
3. Paste it into your Terminal window and press Enter
4. It'll ask for your **Mac password** — type it (nothing shows while you type, that's normal) and press Enter
5. Follow any prompts it gives you. When it finishes, it may tell you to run one or two more commands — do those too.
6. When it's done, run `brew --version` again. You should see a version number.

This takes 5–15 minutes.

---

## Step 4 — Install Node.js

**What Node.js is:** It's the engine that runs the trace-platform code on your computer. You won't interact with it directly much, but it needs to be there.

1. In Terminal, type this and press Enter:
   ```
   brew install node@20
   ```
   Wait for it to finish (a few minutes).

2. When it finishes, Homebrew may tell you to run a command to "link" Node. If it does, copy and run that command. It usually looks something like:
   ```
   brew link node@20
   ```

3. **Verify it worked:**
   Close your Terminal window, open a new one (Cmd+Space → Terminal), and type:
   ```
   node --version
   ```
   You should see `v20.x.x`. If you see an error, ask Andrew — sometimes Node needs a PATH fix and Andrew will know what to do.

---

## Step 5 — Install Claude Code in VS Code

**What Claude Code is:** It's your AI co-writer. It lives inside VS Code. You describe what you want to build, it writes code or makes changes, you review and approve them. You'll use it as your main tool for building your social media measurement project.

1. Open VS Code
2. On the left side of VS Code, find the **Extensions** icon — it looks like four small squares, with one slightly separated from the others. Click it.
3. A search bar appears at the top. Type `Claude Code`.
4. Find the extension from **Anthropic** and click **Install**
5. It will ask you to sign in. You'll need an account at **claude.ai** — if you don't have one, go there now and create one with your email address. The free tier is fine to start.
6. Sign in when prompted.

When it's installed, you'll see a Claude icon appear in VS Code's left sidebar. That's your entry point.

---

## Step 6 — Create your GitHub account

**What GitHub is:** GitHub is where all the TRACE code lives, tracked and saved over time. Every change anyone makes gets recorded here. Your GitHub account is your developer identity — it's how you receive access to the repo and how your contributions get credited.

1. Go to **https://github.com**
2. Click **Sign up**
3. Use your personal email address
4. For your username: pick something professional that you'd be comfortable with long-term. Examples: `eobrien`, `erin-obrien`, your full name without spaces. This is public-facing.
5. You don't need a paid plan. **Free** is fine.

---

## Step 7 — Tell David your GitHub username

Once you have your GitHub username, send it to David (text or message is fine).

He needs it to add you to the trace-platform repository. Until he does, you won't be able to access or download the code. This is a quick step on his end — he can do it in under a minute once he has your username.

---

## Step 8 — Set up an SSH key

**What an SSH key is:** When your computer wants to connect to GitHub to download or upload code, GitHub needs to verify it's actually your computer. An SSH key is a unique digital fingerprint for your computer — it proves "yes, this is Erin's Mac." You create the key on your computer, then tell GitHub about it. After that, GitHub recognizes your computer automatically.

You only do this once per computer.

**Create the key:**

1. Open Terminal
2. Type this (replace `your_email@example.com` with the email you used for GitHub):
   ```
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```
3. It asks **"Enter file in which to save the key"** — just press **Enter** (accept the default)
4. It asks for a **passphrase** — you can press **Enter** twice to skip it (no passphrase), or type a password if you prefer. Either is fine.
5. The key is created. You'll see some text with a little picture made of symbols — that's the key's "fingerprint." Normal.

**Copy the key so you can give it to GitHub:**

6. Type this in Terminal and press Enter:
   ```
   pbcopy < ~/.ssh/id_ed25519.pub
   ```
   Nothing visible happens, but the key is now copied to your clipboard.

**Add the key to GitHub:**

7. Go to **github.com** and sign in
8. Click your profile picture (top right) → **Settings**
9. In the left menu, click **"SSH and GPG keys"**
10. Click **"New SSH key"**
11. Give it a name: `Erin's MacBook` or similar
12. In the **Key** box, paste (Cmd+V) — your key should appear (a long string of letters and numbers)
13. Click **Add SSH key**

**Test that it worked:**

14. In Terminal, type:
    ```
    ssh -T git@github.com
    ```
15. It may ask if you want to continue connecting — type `yes` and press Enter
16. You should see: `Hi [your username]! You've successfully authenticated...`

That means your computer and GitHub recognize each other.

---

## Step 9 — Clone the repository

**What "clone" means:** It copies all the project files from GitHub down to your computer. You end up with a full local copy you can open and edit.

**Wait for David to add you to the repo first (Step 7).** Once he's done, he'll give you the clone URL.

1. In Terminal, go to your Desktop:
   ```
   cd ~/Desktop
   ```
2. Run the clone command. David will give you the exact URL, but it'll look like:
   ```
   git clone git@github.com:david-obrien61/trace-platform.git
   ```
3. Type your passphrase if you set one in Step 8. Press Enter.
4. Wait a minute or two while it downloads. You'll see progress messages.
5. When it finishes, a folder called `trace-platform` appears on your Desktop.

---

## Step 10 — Open the project in VS Code

You can do this two ways — use whichever feels natural:

**Option A (from Terminal):**
```
cd ~/Desktop/trace-platform
code .
```
The `.` means "open the current folder." VS Code opens with all the project files in the left sidebar.

**Option B (from VS Code directly):**
- Open VS Code
- File → Open Folder
- Navigate to your Desktop → trace-platform → Open

Either way, you'll see the project files listed on the left side.

---

## Step 11 — First-time project setup

The project has a lot of code that depends on other code libraries. You need to download those once before the project will run.

1. In VS Code, open the built-in Terminal: go to the menu bar → **View → Terminal**. A terminal panel opens at the bottom of VS Code.

2. Make sure you're in the right folder. You should see `trace-platform` in the terminal prompt. If not, type `cd ~/Desktop/trace-platform` and press Enter.

3. Type this and press Enter:
   ```
   npm install
   ```

4. Wait 5–10 minutes. A lot of text scrolls by — that's normal. It's downloading the libraries the project needs.

5. When it finishes and you see the prompt again, you're done.

If you see any **red error messages**, take a screenshot and ask Andrew. Some warnings in yellow are usually fine.

---

## You're ready

The project is on your computer. You can open files, read the code, edit things, and use Claude Code to help you write.

**What's next depends on your conversation with David** about scope — specifically what part of the social media measurement concept you're starting with. Come back to him with that question before diving in.

---

## When you get stuck

Getting stuck is normal. Even experienced developers get stuck. Here are the most common errors and what they mean:

| Error message | What it probably means | What to try |
|---|---|---|
| `permission denied` | Your computer needs authorization to do this | Try the same command with `sudo ` in front (e.g., `sudo npm install`). It'll ask for your Mac password. |
| `command not found` | The tool either isn't installed, or your Terminal doesn't know where to find it | Ask Andrew — this is usually a quick PATH fix |
| `cannot find module` | A library the code needs is missing | Run `npm install` in the project folder and try again |
| `port already in use` | Something else is using that port | Ask Andrew |
| Anything with `permission denied (publickey)` | SSH key isn't connected to GitHub correctly | Re-do Step 8, or ask Andrew |

**For anything else:** Screenshot the error and send it to Andrew or Connor. The error message text is the most useful thing — they can usually diagnose it in 30 seconds if they can see the exact text.

---

## How to use Claude Code day to day

Once you're set up, Claude Code (the extension you installed in Step 5) is your main building tool.

**The basic pattern:**
1. Open the project in VS Code
2. Click the Claude icon in the left sidebar to open the chat panel
3. Describe what you want to build or change in plain language
4. Claude writes the code or makes the edit
5. You review what it did and approve it (or ask it to adjust)

You don't have to understand every line of code it writes. You do need to understand **what it's doing** well enough to tell it if it's on the right track.

**Where Lightning fits in:** David's chat conversations with Lightning (his Claude chat partner) often produce strategic thinking about what to build. Those conversations can be copied into a Claude Code session as context — "Lightning and David figured out this approach, now build it." You'll develop your own version of this working pattern.

**For your first project:** Start with one small, specific thing. Don't try to build the whole concept at once. Define the smallest useful version of your first feature and build that. Then expand from there.

---

*This guide was written for Erin O'Brien, 2026-06-03. If you run into a step that's changed or unclear, tell David and he'll update it.*
