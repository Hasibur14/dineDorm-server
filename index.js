const express = require('express');
const app = express();
const cors = require('cors');
//const jwt = require('jsonwebtoken')
require('dotenv').config();
//const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.lfxjcnl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {


        const mealCollection = client.db('dineDorm').collection('meals');
        const userCollection = client.db('dineDorm').collection('users');


        /**
            * -------------------------------------------
            *                  USERS RELATED API
            * -------------------------------------------
            */








        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello from Dine Dorm Server..');
});

app.listen(port, () => {
    console.log(`dine dorm is running on port ${port}`);
});