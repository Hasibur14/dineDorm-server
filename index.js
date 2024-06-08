const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
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
        const requestMealsCollection = client.db('dineDorm').collection('requestMeals');
        const packageCollection = client.db('dineDorm').collection('packages');
        const paymentCollection = client.db('dineDorm').collection('payments');


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };



        // Get all user in db(admin)
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        //get user in db(user)
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const result = await userCollection.findOne({ email })
            res.send(result)
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })


        // user info save in db for user signup
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'User already exits', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)

        });

        // Change user role 
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        });

        //Delete user in db
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })


        /**
                 -------------------------------------------
                               MEALS RELATED API
                 -------------------------------------------
     */


        app.get('/meals', async (req, res) => {
            const result = await mealCollection.find().toArray()
            res.send(result)
        });

        //get all meal for category in db
        app.get('/meal', async (req, res) => {
            const result = await mealCollection.find().toArray()
            res.send(result)
        });

        // Get a single room data from db using _id
        app.get('/meal/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await mealCollection.findOne(query)
            res.send(result)
        });

        // Save meals in db
        app.post('/meal', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await mealCollection.insertOne(item);
            res.send(result);
        });

        //update a meal
        app.patch('/meal/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    ...item
                }
            }

            const result = await mealCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        //delete a single meal
        app.delete('/meal/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealCollection.deleteOne(query);
            res.send(result);
        });

        /**
                 -------------------------------------------
                              meal request api
                 -------------------------------------------
     */
        // Get all request meals
        app.get('/requestMeals', async (req, res) => {
            const result = await requestMealsCollection.find().toArray()
            res.send(result)
        });

        // Save requested meals in db
        app.post('/requestMeal', async (req, res) => {
            const item = req.body
            const result = await requestMealsCollection.insertOne(item)
            res.send(result)
        });

        //delete a single Request meal
        app.delete('/requestMeal/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await requestMealsCollection.deleteOne(query);
            res.send(result);
        });

        //update delivery status
        app.patch('/requestMeal/:id', async (req, res) => {
            const id = req.params.id
            const status = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: status,
            }
            const result = await requestMealsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        /**
                       -------------------------------------------
                                   Package api
                       -------------------------------------------
           */

        app.get('/packages', async (req, res) => {
            const result = await packageCollection.find().toArray();
            res.send(result);
        });





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