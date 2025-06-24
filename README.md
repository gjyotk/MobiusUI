# **Mobius UI**

A React-based frontend to display Mobius data in a lazy-loading tree fashion.

---

## Features

* **Lazy Loading Tree**: Loads Mobius data on-demand as the user expands nodes.
* **Minimal UI**: Clean, simple interface focused on data presentation.
* **Responsive Design**: Adapts to different screen sizes.
* **Configurable**: Easily tweak endpoints and tree behavior.

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/mobius-tree-frontend.git
   cd mobius-tree-frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   or

   ```bash
   yarn install
   ```

---

## Usage

1. **Start the development server**

   ```bash
   npm start
   ```

   or

   ```bash
   yarn start
   ```

2. **Open in browser**
   Navigate to `http://localhost:3000` to view the app.

3. **Configure API endpoint**

   * Edit the `src/config.js` (or `.env`) with your Mobius API base URL.

---

## Project Structure

```
mobius-tree-frontend/
├─ public/
│  └─ index.html
├─ src/
│  ├─ components/
│  │  ├─ TreeView.js      # Lazy-loading tree component
│  │  └─ Node.js          # Single tree node component
│  ├─ config.js           # API endpoint and settings
│  ├─ App.js              # Main application file
│  └─ index.js            # Entry point
├─ package.json
└─ README.md
```

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a pull request

Please follow the existing code style and include tests for new functionality.
