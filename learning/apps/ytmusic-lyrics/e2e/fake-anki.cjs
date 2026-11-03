// Minimal AnkiConnect stand-in: records what the extension sends.
const http = require("http");
const notes = [];
const models = [];
const decks = ["Default"];
http
  .createServer((req, res) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      if (req.method === "OPTIONS") return res.end();
      const { action, params } = JSON.parse(body || "{}");
      let result = null;
      let error = null;
      switch (action) {
        case "requestPermission":
          result = { permission: "granted", requireApikey: false, version: 6 };
          break;
        case "modelNames":
          result = models;
          break;
        case "createModel":
          models.push(params.modelName);
          result = {};
          break;
        case "deckNames":
          result = decks;
          break;
        case "createDeck":
          decks.push(params.deck);
          result = 1;
          break;
        case "addNote":
          if (notes.some(n => n.fields.ItemId === params.note.fields.ItemId)) {
            error = "cannot create note because it is a duplicate";
          } else {
            notes.push(params.note);
            result = 1000 + notes.length;
          }
          break;
        case "debugNotes":
          result = { notes, models, decks };
          break;
        default:
          error = `unsupported action ${action}`;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ result, error }));
    });
  })
  .listen(8765, "127.0.0.1", () => console.log("fake anki on 8765"));
