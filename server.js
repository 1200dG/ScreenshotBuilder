const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/screenshot", async (req, res) => {
  const { url, part } = req.query;

  if (!url || !part) {
    return res.status(400).json({ error: "Missing 'url' or 'part' query parameters" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 1400, height: 1000 }
    });

    const page = await browser.newPage();
    console.log(`🌍 Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Accept cookies if the button exists
    try {
      await page.waitForSelector("button", { timeout: 3000 });
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const acceptBtn = btns.find(b =>
          b.textContent.toLowerCase().includes("aceitar") ||
          b.textContent.toLowerCase().includes("accept")
        );
        if (acceptBtn) acceptBtn.click();
      });
      console.log("🍪 Accepted cookies.");
    } catch (e) {
      console.log("⚠️ No cookie popup found.");
    }

    // Scroll slowly to load lazy content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 300);
      });
    });

    // Wait for images to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fullHeight = await page.evaluate(() => document.body.scrollHeight);
    const partHeight = Math.ceil(fullHeight / 3);
    const yOffsetMap = {
      top: 0,
      middle: partHeight,
      bottom: partHeight * 2
    };

    const yOffset = yOffsetMap[part];
    if (yOffset === undefined) {
      await browser.close();
      return res.status(400).json({ error: "Invalid 'part' value. Use top, middle, or bottom." });
    }

    console.log(`📸 Taking screenshot for ${part} (y=${yOffset})...`);

    const screenshot = await page.screenshot({
      type: "jpeg",
      clip: {
        x: 0,
        y: yOffset,
        width: 1400,
        height: Math.min(partHeight, fullHeight - yOffset)
      }
    });

    await browser.close();
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    console.error("❌ Screenshot failed:", err);
    res.status(500).json({ error: "Failed to generate screenshot", details: err.message });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`✅ Screenshot server running at http://localhost:${PORT}`);
});
