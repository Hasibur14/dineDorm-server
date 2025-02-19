const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        const upcomingMealCollection = client.db('dineDorm').collection('upcomingMeals');
        const userCollection = client.db('dineDorm').collection('users');
        const requestMealsCollection = client.db('dineDorm').collection('requestMeals');
        const reviewCollection = client.db('dineDorm').collection('reviews');
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

        // Like a meal
        app.post('/meal/:id/like', async (req, res) => {
            const { id } = req.params;
            const { userId } = req.body;

            try {
                const meal = await mealCollection.findOne({ _id: new ObjectId(id) });

                if (meal.likedBy && meal.likedBy.includes(userId)) {
                    return res.status(400).send('User has already liked this meal');
                }

                // Update the meal's like count and likedBy array
                const updatedDoc = {
                    $inc: { likes: 1 },
                    $push: { likedBy: userId }
                };

                const result = await mealCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updatedDoc
                );

                res.send(result);
            } catch (error) {
                res.status(500).send(error.message);
            }
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
        });



        /**
              -------------------------------------------
                            Package api
             -------------------------------------------
           */

        app.get('/packages', async (req, res) => {
            const result = await packageCollection.find().toArray();
            res.send(result);
        });

        app.get('/package/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await packageCollection.findOne(query)
            res.send(result)
        });

        // Package checkout  from db using _id
        app.get('/checkout/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await packageCollection.findOne(query)
            res.send(result)
        });

        /**
            -------------------------------------------
                    payment intent
             -------------------------------------------
         */
        //Get payment info in db
        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });


        //payment history save in db
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const email = payment.email;
            const newBadge = payment.badge; 
            try {
                const userQuery = { email };
                const userUpdate = {
                    $set: {
                        badge: newBadge
                    }
                };
                await userCollection.updateOne(userQuery, userUpdate);       
                // Save payment in paymentCollection
                const paymentResult = await paymentCollection.insertOne(payment);     
                res.send({ paymentResult });
            } catch (error) {
                console.error('Error processing payment:', error.message);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });
        



        //PAYMENT INTENT
        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { price } = req.body;
                const amount = parseInt(price * 100);
                console.log(amount, 'amount inside the intent');

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card'], // Correct key name
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                console.error('Error creating payment intent:', error.message); // Log the error message
                if (error.raw) {
                    console.error('Raw error:', error.raw); // Log the raw error from Stripe
                }
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        /**
               -------------------------------------------
                         REVIEW By USER
              -------------------------------------------
     */

        // Get all reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        });

        //user review save in db
        app.post('/reviews', async (req, res) => {
            const item = req.body
            const result = await reviewCollection.insertOne(item)
            res.send(result)
        });

        //Edit review in user
        app.patch('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const { review } = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { review },
            };
            const result = await reviewCollection.updateOne(query, updateDoc);
            res.send(result);
        });


        //delete a single review
        app.delete('/review/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await reviewCollection.deleteOne(query);
            res.send(result);
        });


        /**
             -------------------------------------------
                         UPCOMING MEALS
             -------------------------------------------
     */

        app.get('/upcomingMeals', async (req, res) => {
            const result = await upcomingMealCollection.find().toArray()
            res.send(result)
        })

        // Save upcoming meal in db
        app.post('/upcomingMeal', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await upcomingMealCollection.insertOne(item);
            res.send(result);
        });

        // Move meal from upcomingMeals to meals
        app.post('/moveMeal', verifyToken, verifyAdmin, async (req, res) => {
            const { mealId } = req.body;

            try {
                console.log('Received request to move meal with ID:', mealId);

                // Find the meal in the upcomingMeals collection
                const meal = await upcomingMealCollection.findOne({ _id: new ObjectId(mealId) });
                if (!meal) {
                    console.log('Meal not found:', mealId);
                    return res.status(404).send('Meal not found');
                }

                // Clone the meal document and assign a new _id
                const newMeal = { ...meal, _id: new ObjectId() };

                // Insert the meal into the meals collection
                const insertResult = await mealCollection.insertOne(newMeal);
                console.log('Meal inserted:', insertResult);

                // Remove the meal from the upcomingMeals collection
                const deleteResult = await upcomingMealCollection.deleteOne({ _id: new ObjectId(mealId) });
                console.log('Meal deleted from upcomingMeals:', deleteResult);

                res.status(200).send('Meal moved successfully');
            } catch (error) {
                console.error('Error moving meal:', error);
                res.status(500).send('Internal Server Error');
            }
        });




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