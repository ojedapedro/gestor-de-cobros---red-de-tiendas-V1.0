import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "1QGW3Y_jslEvVN6UbsCZ9b9dW7QI5ugvjGXjoUVufLjA";

// Helper to get Google Sheets client
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Initialize Sheet Structure
app.post("/api/init-sheet", async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    
    // Check if sheets exist, if not create them
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    
    const requiredSheets = ["Payments", "Settings"];
    
    for (const name of requiredSheets) {
      if (!sheetNames.includes(name)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: name } } }],
          },
        });
      }
    }

    // Set Headers for Payments
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Payments!A1:I1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["Fecha", "Tienda", "Metodo Pago", "Monto Original", "Moneda", "Tasa", "Monto USD", "Referencia", "Descripcion"]],
      },
    });

    // Set Initial Settings (Exchange Rate)
    const settingsCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Settings!A1:B2",
    });

    if (!settingsCheck.data.values || settingsCheck.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Settings!A1:B2",
        valueInputOption: "RAW",
        requestBody: {
          values: [["Setting", "Value"], ["ExchangeRate", "36.5"]],
        },
      });
    }

    res.json({ success: true, message: "Sheet initialized successfully" });
  } catch (error: any) {
    console.error("Init Sheet Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Payments
app.get("/api/payments", async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Payments!A2:I",
    });

    const rows = response.data.values || [];
    const payments = rows.map((row, index) => ({
      id: index,
      date: row[0],
      store: row[1],
      method: row[2],
      amountOriginal: parseFloat(row[3]),
      currency: row[4],
      rate: parseFloat(row[5]),
      amountUsd: parseFloat(row[6]),
      reference: row[7],
      description: row[8],
    }));

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add Payment
app.post("/api/payments", async (req, res) => {
  try {
    const { date, store, method, amountOriginal, currency, rate, amountUsd, reference, description } = req.body;
    const sheets = await getSheetsClient();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Payments!A2:I2",
      valueInputOption: "RAW",
      requestBody: {
        values: [[date, store, method, amountOriginal, currency, rate, amountUsd, reference, description]],
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Settings
app.get("/api/settings", async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Settings!A2:B",
    });
    const rows = response.data.values || [];
    const settings: any = {};
    rows.forEach(row => {
      settings[row[0]] = row[1];
    });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Exchange Rate
app.post("/api/settings/rate", async (req, res) => {
  try {
    const { rate } = req.body;
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Settings!B2",
      valueInputOption: "RAW",
      requestBody: {
        values: [[rate]],
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
