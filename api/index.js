const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 4000;

// middleware

app.use(cors());
app.use(express.json());

// ------------------
// Verify JWT Token 
// ------------------

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorised Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ktrjuta.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try{
        await client.connect();
        const productCollection = client.db('lukas_manufacturer').collection('products');
        const orderCollection = client.db('lukas_manufacturer').collection('orders');
        const userCollection = client.db('lukas_manufacturer').collection('users');
        const reviewCollection = client.db('lukas_manufacturer').collection('reviews');

        // --------------------
        // Auth API
        // --------------------

        app.post('/login', async(req, res)=>{
            const user = req.body;
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            })
            res.send({accessToken: accessToken, token : true});
        })

        app.get('/hello', async (req,res) => {
            res.send({
                message: "Hello"
            })
        })

        // ---------------------
        // Verify Admin 
        // ---------------------

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ messege: 'Forbidden Access' })
            }
        }

        // -----------------------
        // API's For All Products
        // -----------------------

        app.post('/product', async(req, res)=>{
            const product = req.body.product;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        app.get('/products', async (req, res)=>{
            const query = {};
            const products = await productCollection.find(query).toArray();
            res.send(products)
        })

        app.get('/products/:id', verifyToken, async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const product = await productCollection.findOne(query);
            res.send(product)
        })

        app.delete('/product/:id', verifyToken, verifyAdmin, async (req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })

        // ----------------------
        // API's For All Order
        // ----------------------

        app.post('/order', async(req, res) =>{ // removed verify token but it needs to be checked
            const order = req.body.order;
            const result = await orderCollection.insertOne(order);
            res.send(result)
        })

        app.get('/orders',  async(req, res)=>{
            const orders = await orderCollection.find().toArray();
            res.send(orders)
        })

        app.get('/order/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};
            const orders = await orderCollection.find(query).toArray();
            res.send(orders)
        })

        app.get('/order', async(req, res)=>{
            const id = req.query.id;
            const query = {_id: ObjectId(id)}
            const order = await orderCollection.findOne(query);
            res.send(order)
        })

        app.patch('/order/:id', async(req, res)=>{
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)}
            const updatedDoc = {
                $set:{
                    paid: true,
                    pending: true,
                    shipped: false,
                    transactionId: payment.transactionId
                }
            }
            const result = await orderCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.patch('/order', async(req, res)=>{
            const {productId} = req.body;
            const filter = {_id: ObjectId(productId)}
            const updatedDoc = {
                $set:{
                    shipped: true,
                    pending: false
                }
            }
            const result = await orderCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/order/:id', verifyToken, verifyAdmin, async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await orderCollection.deleteOne(query);
            res.send(result)
        })

        // --------------------
        // API's For All Users
        // --------------------

        app.post('/user', async (req, res)=>{
            const user = req.body.user;
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.get('/user/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {email: email}
            const user = await userCollection.findOne(query)
            res.send(user)
        })

        app.get('/user', async(req, res)=>{
            const users = await userCollection.find().toArray();
            res.send(users)
        })

        app.put('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        app.put('/user', async(req, res)=>{
            const user = req.body.user;
            const filter = {email : user.email}; 
            const options = {upsert: true};
            const updatedDoc ={
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        });

        // -----------------------
        // API For All Reviews
        // -----------------------
        
        app.post('/review', async(req, res)=>{
            const review = req.body.review;
            const result = await reviewCollection.insertOne(review);
            res.send(result)
        })

        app.get('/review',  async(req, res)=>{
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews);
        })

        app.get('/review/:id', async (req, res)=>{
            const productId = req.params.id;
            const reviews = await reviewCollection.find({productId: productId}).toArray();
            res.send(reviews);
        })

        // -----------------------------
        // API For STRIPE Payment Intent 
        // ------------------------------

        app.post('/create-payment-intent', async (req, res)=>{
            const price = req.body.total;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount : amount,
                currency : 'usd',
                payment_method_types: ['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
        }) 
    }
    finally{

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Lukas Manufacturer Site Running')
})

app.listen(port, ()=>{
    console.log('Listening', port);
})