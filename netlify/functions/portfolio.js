// netlify/functions/portfolio.js
import fetch from "node-fetch";

export async function handler() {
  try {
    const sheetUrl =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQCdqkP9i.../pub?gid=0&single=true&output=csv"; // kendi CSV yayın linkini buraya koy

    const res = await fetch(sheetUrl);
    const text = await res.text();

    // CSV'yi satırlara böl
    const [headerLine, ...lines] = text.trim().split("\n");
    const headers = headerLine.split(",");

    const data = lines.map((line) => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = values[i] ? values[i].trim() : "";
      });
      return obj;
    });

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: err.toString() };
  }
}
