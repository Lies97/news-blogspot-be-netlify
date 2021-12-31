"use strict";
const express = require("express");
const serverless = require("serverless-http");
const router = express.Router();
const cheerio = require("cheerio");
const chromium = require("chrome-aws-lambda");
require('encoding');
const app = express();
let articles = [];

const url = "https://www.theguardian.com/uk";

const webScarping = async (res) => {
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  await page.goto(url, {
    waitUntil: "load",
    timeout: 0,
  });

  const html = await page.content();
  const $ = cheerio.load(html);

  $(".fc-item__container", html).each(async function () {
    const title = $(this).find(".fc-item__title").text();
    const url = $(this).find("a").attr("href");
    const thumbnail = $(this)
      .find(".fc-item__image-container > picture > img")
      .attr("src");

    const description = $(this)
      .find(".fc-item__standfirst")
      .text()
      .replace("\n", "")
      .trim();
    const article = { title, url, thumbnail, description };
    if (
      article.thumbnail &&
      article.url &&
      article.thumbnail &&
      article.description
    ) {
      articles.push(article);
    }
  });

  articles = Array.from(new Set(articles.map((a) => a.title))).map((title) => {
    return articles.find((a) => a.title === title);
  });

  res.send(articles);
};

const scarpArticle = async (urlLink, res) => {
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  if (articles.length > 0) {
    const article = articles.find((article) => article.url.includes(urlLink));
    const newPage = await browser.newPage();
    await newPage.goto(article.url, {
      waitUntil: "load",
      timeout: 0,
    });

    const html = await newPage.content();
    const $$ = cheerio.load(html);
    const sections = [];
    const image = $$("picture > img").attr("src");

    $$(".article-body-commercial-selector > p", html).each(async function (a) {
      sections.push($$(this).text());
    });

    article["image"] = image;
    article["contentSections"] = sections;
    res.send(article);
    newPage.close();
  } else {
    const page = await browser.newPage();
    const articlesArray = [];
    await page.goto(url, {
      waitUntil: "load",
      timeout: 0,
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    $(".fc-item__container", html).each(async function () {
      const title = $(this).find(".fc-item__title").text();
      const link = $(this).find("a").attr("href");
      const thumbnail = $(this)
        .find(".fc-item__image-container > picture > img")
        .attr("src");

      const article = { title, url: link, thumbnail };

      setTimeout(async () => {
        if (article.url.includes(urlLink)) {
          const newPage = await browser.newPage();
          await newPage.goto(article.url, {
            waitUntil: "load",
            timeout: 0,
          });
          const sections = [];
          console.log(article.url);
          const html = await newPage.content();
          const $$ = cheerio.load(html);
          $$(".article-body-commercial-selector > p", html).each(
            async function (a) {
              sections.push($$(this).text());
            }
          );

          const image = $$("picture > img").attr("src");
          article["contentSections"] = sections;
          article["image"] = image;
          articlesArray.push(article);

          newPage.close();
          res.send(article);
        }
      }, 1000);
    });
  }
};

router.get("/", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write("<h1>Hello from Express.js!</h1>");
  res.end();
});

router.get("/api/articles", (req, res) => {
  console.log('abc');
  webScarping(res);
});

router.get("/api/article/:url", (req, res) => {
  scarpArticle(req.params.url, res);
});

app.use("/.netlify/functions/server", router); // path must route to lambda

module.exports = app;
module.exports.handler = serverless(app);
