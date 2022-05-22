const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware



app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zgsqx.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try{
        await client.connect();
        const productCollection = client.db('lukas_manufacturer').collection('products');

        // Auth API
        app.post('/login', async(req, res)=>{
            const user = req.body;
            console.log(user);
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            })
            res.send({accessToken: accessToken, token : true});
        })

        // get all products
        app.get('/products', async (req, res)=>{
            const query = {};
            const products = await productCollection.find(query).toArray();
            res.send(products)
        })

        app.get('/products/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const product = await productCollection.findOne(query);
            res.send(product)
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