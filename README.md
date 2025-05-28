# 🏁 Scoreboard Web App

This is a modern React-based web app to serve as a Bluetooth-enabled wrestling scoreboard. The app supports timer control, scoring, and integration with ESP32-based wristbands via the Web Bluetooth API.

---

## 📦 Stack
- **Framework:** React
- **Styling:** Tailwind CSS
- **Bluetooth:** Web Bluetooth API
- **Build Tool:** Vite
- **Hosting:** Vercel
- **Version Control:** GitHub
- **Editor:** VS Code

---

## 🚀 Getting Started (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/scoreboard-web.git
cd scoreboard-web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
- Open your browser to `http://localhost:5173`

---

## 🎨 Tailwind Setup
Already configured in:
- `tailwind.config.js`
- `src/index.css`

Edit styles using Tailwind utility classes.

---

## 🔧 Web Bluetooth (Planned)
This app will soon integrate:
- Bluetooth pairing with ESP32 wristbands
- Timer and score updates triggered by BLE events

---

## 🌍 Deployment (Later Step)
Will be deployed to:
- **Vercel** with automatic HTTPS
- Linked to a custom domain

---

## 🛠️ Scripts
```bash
npm run dev      # Start local server
npm run build    # Build for production
npm run preview  # Preview production build locally
```

---

## 🤝 Contributing
PRs welcome once BLE integration is stable!

---

## 📄 License
MIT (or your preferred license)
