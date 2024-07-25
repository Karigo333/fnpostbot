import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import axios from "axios";
import axiosRetry from 'axios-retry';

let apiUrl;
let vbuckIcon;
let length;
export let dailyEntries;

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export async function fetchShopData() {
  try {
    const response = await axios.get(apiUrl, { timeout: 10000 });
    if (response.data && response.data.data) {
      dailyEntries = response.data.data.date;
      vbuckIcon = response.data.data.vbuckIcon;
      length = response.data.data.featured ? response.data.data.featured.entries.length : 0;
      return response.data.data;
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (error) {
    console.error("Error fetching data:", error.message);
    throw error;
  }
}

function setBackgroundColor(rarity) {
  switch (rarity) {
    case "epic":
      return ["#BF57FB", "#522689"]; //violet
    case "icon":
      return ["#36B6B6", "#256C6C"]; //sky
    case "uncommon":
      return ["#60AE1D", "#1C5718"]; //green
    case "legendary":
      return ["#E18723", "#7E3B1D"]; //orange
    case "starwars":
      return ["#5273C4", "#263765"]; //black
    case "rare":
      return ["#2AB5F4", "#153F7E"]; //blue
    case "marvel":
      return ["#BE3131", "#791C1C"]; //red
    case "shadow":
      return ["#616161", "#1F1F1F"]; //gray
    case "slurp":
      return ["#28EFA3", "#13ABA4"]; //ocean
    case "common":
      return ["#BBBBBB", "#686868"]; //light_gray
    default:
      return ["#9C9FF2", "#2A52BE"]; //blue
  }
}

function getDaysDifference(shopHistory) {
  if (shopHistory.length < 1) {
    return;
  }

  const lastDate = new Date(shopHistory[shopHistory.length - 1]);
  const date = new Date();

  let day;
  let days;
  let today;

  if (apiUrl === 'https://fortnite-api.com/v2/shop/br?language=ru') {
    day = 'ДЕНЬ';
    days = 'ДН.';
    today = 'СЕГОДНЯ';
  }
  else {
    day = 'DAY';
    days = 'DAYS';
    today = 'TODAY';
  }

  if (shopHistory.length === 1) {
    const timeDifference = date.getTime() - lastDate.getTime();
    const daysDifference = Math.round(timeDifference / (1000 * 60 * 60 * 24));
    if (daysDifference === 1) {
      return `${daysDifference} ${day}`;
    }
    return `${daysDifference} ${days}`;
  }

  const secondLastDate = new Date(shopHistory[shopHistory.length - 2]);
  const timeDifference = lastDate.getTime() - secondLastDate.getTime();
  const daysDifference = Math.round(timeDifference / (1000 * 60 * 60 * 24));

  if (daysDifference === 1) {
    return `${daysDifference} ${day}`;
  }
  if (daysDifference === 0) {
    return `${today}`;
  }
  return `${daysDifference} ${days}`;
}

function drawText(ctx, text, x, y, maxWidth, maxHeight) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = Math.min(maxWidth / 10, maxHeight / 2);

  function splitTextIntoLines(text, maxWidth) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (const word of words) {
      const testLine = line + word + " ";
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth) {
        lines.push(line.trim());
        line = word + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    return lines;
  }

  let lines;
  let lineHeight;
  let textHeight;
  do {
    ctx.font = `bold ${fontSize}px tahoma`;
    lines = splitTextIntoLines(text, maxWidth);
    lineHeight = ctx.measureText("M").width * 1.2;
    textHeight = lines.length * lineHeight;
    fontSize--;
  } while (textHeight > maxHeight && fontSize > 10);

  ctx.fillStyle = "white";
  let textY = y - textHeight / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, x, textY);
    textY += lineHeight;
  }
}

const applyImageEffects = async (ctx, imagePath, x, y, width, height, rarity, name, finalPrice, vbuckIcon, shopHistory) => {
  try {
    const [image, vbuck] = await Promise.all([loadImage(imagePath), loadImage(vbuckIcon)]);

    const gradient = ctx.createRadialGradient(x + width / 2, y + height / 2, 0, x + width / 2, y + height / 2, Math.min(width, height) / 1.5);
    const [firstColor, secondColor] = setBackgroundColor(rarity);
    gradient.addColorStop(0, firstColor);
    gradient.addColorStop(1, secondColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = firstColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, width, height);
    ctx.drawImage(image, x, y, width, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const rectY = y + height * 0.75;
    const rectHeight = height * 0.25;
    ctx.fillRect(x, rectY - 10, width, rectHeight + 10);

    drawText(ctx, name.toUpperCase(), x + width / 2, rectY + rectHeight / 2 - 20, width - 40, rectHeight - 20);

    if (shopHistory.length) {
      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.min(width / 15, height / 3)}px tahoma`;
      ctx.textAlign = 'left';
      ctx.fillText(getDaysDifference(shopHistory), x + 10, y + height - 15);
    }

    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.min(width / 15, height / 3)}px  tahoma`;
    ctx.textAlign = 'right';
    ctx.fillText(finalPrice, x + width - 40, y + height - 15);
    ctx.drawImage(vbuck, x + width - 40, y + height - 30, 35, 35);

  } catch (error) {
    console.error('Error loading image:', error);
  }
};

const createShopImage = async (shopData) => {
  const canvasWidth = 4096;
  const margin = 20;
  const textHeight = 150;

  const numItems = shopData.featured.entries.length;
  const numColumns = Math.ceil(Math.sqrt(numItems));
  const itemWidth = Math.floor((canvasWidth - margin * (numColumns + 1)) / numColumns);
  const itemHeight = itemWidth;

  const numRows = Math.ceil(numItems / numColumns);
  const canvasHeight = textHeight + margin + numRows * (itemHeight + margin);

  let x = margin;
  let y = textHeight + margin;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  try {
    const backgroundImage = await loadImage(process.env.BACKGROUND_IMAGE_PATH);
    ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
  } catch (error) {
    console.error("Error loading background image:", error);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 100px tahoma";
  ctx.fillText(process.env.HEADER_TEXT, 50, 100);

  for (const item of shopData.featured.entries) {
    const imageUrl = item.bundle?.image || item.items[0].images.featured || item.items[0].images.icon;
    const name = item.bundle?.name || item.items[0].name;
    const finalPrice = item.finalPrice;
    const rarity = item.items[0].rarity.value;
    const shopHistory = item.items[0].shopHistory;
    await applyImageEffects(ctx, imageUrl, x, y, itemWidth, itemHeight, rarity, name, finalPrice, shopData.vbuckIcon, shopHistory);

    const optionsImages = [];
    if (imageUrl === item.items[0].images.featured) {
      for (let i = 1; i < item.items.length; i++) {
        if (item.items[i].images.smallIcon || item.items[i].images.icon) {
          optionsImages.push(item.items[i].images.smallIcon || item.items[i].images.icon);
        }
      }
    }

    const optionSize = Math.min(300, itemWidth / 3);
    for (let i = 0; i < optionsImages.length; i++) {
      const optionImage = await loadImage(optionsImages[i]);
      const optionY = y + i * optionSize;
      if (optionY + optionSize <= y + itemHeight) {
        ctx.drawImage(optionImage, x, optionY, optionSize, optionSize);
      }
    }

    x += itemWidth + margin;
    if (x + itemWidth + margin > canvasWidth) {
      x = margin;
      y += itemHeight + margin;
    }
  }

  const buffer = canvas.toBuffer("image/jpeg");
  if (apiUrl === 'https://fortnite-api.com/v2/shop/br?language=ru') {
    fs.writeFileSync(`./images/shop-ru.jpg`, buffer);
  }
  else if (apiUrl === 'https://fortnite-api.com/v2/shop/br?language=en') {
    fs.writeFileSync(`./images/shop-en.jpg`, buffer);
  }
};


export async function createImagesSequentially() {
  try {
    apiUrl = "https://fortnite-api.com/v2/shop/br?language=ru";
    const shopDataRU = await fetchShopData();
    await createShopImage(shopDataRU);
    console.log('Image for language ru created.');

    apiUrl = "https://fortnite-api.com/v2/shop/br?language=en";
    const shopDataEN = await fetchShopData();
    await createShopImage(shopDataEN);
    console.log('Image for language en created.');

  } catch (error) {
    console.error('Error creating images:', error);
  }
}
