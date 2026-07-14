import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set a good resolution for the screenshot
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log("Navigating to virtual store...");
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  // Wait for Babylon.js to render
  await new Promise(r => setTimeout(r, 3000));
  
  const outPath1 = path.join(__dirname, 'public', 'store_screenshot1.png');
  await page.screenshot({ path: outPath1 });
  console.log("Saved screenshot 1:", outPath1);
  
  // Simulate clicking on the middle T-shirt (id_2 is at x:0, y:1.35, z:1.5)
  // In a 1920x1080 window, the middle object should be near the center
  await page.mouse.click(960, 540);
  
  // Wait for animation to finish and UI to slide in
  await new Promise(r => setTimeout(r, 2000));
  
  const outPath2 = path.join(__dirname, 'public', 'store_screenshot2.png');
  await page.screenshot({ path: outPath2 });
  console.log("Saved screenshot 2:", outPath2);
  
  await browser.close();
  console.log("Done.");
})();
