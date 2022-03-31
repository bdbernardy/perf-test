const Redis = require("ioredis");
const { MongoClient } = require("mongodb");

const express = require('express');
const fastify = require('fastify');
const cluster = require("cluster");

const { definedLuaScripts, getRouteData } = require('./redis');

const USE_FASTIFY = true;

const app = USE_FASTIFY ? fastify() : express();
const port = 3000;
const numberOfClusters = 6;

async function start() {
  if (cluster.isMaster) {
    for (let i = 0; i < numberOfClusters; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
      console.log("Let's fork another worker!");
      cluster.fork();
    });
  } else {
    const redis = new Redis();
    definedLuaScripts(redis);

    const uri = "mongodb://localhost:27017?maxPoolSize=5";
    const client = new MongoClient(uri);

    await client.connect();
    const collection = client.db("landingPages").collection("routes");

    app.get('/', (req, res) => {
      res.send('Hello World!');
    });

    app.get('/redis/:origin/:destination', async (req, res) => {
      const { origin, destination } = req.params;
      const data = await getRouteData(redis, origin, destination);
      return USE_FASTIFY ? data : res.json(data);
    })

    app.get('/mongo/:origin/:destination', async (req, res) => {
      const { origin, destination } = req.params;
      const _id = `${origin}/${destination}`;
      const data = await collection.findOne({ _id });
      return USE_FASTIFY ? data : res.json(data);
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  }
}

start();