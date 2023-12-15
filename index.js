const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = 5000;
require('dotenv').config();

// middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('hello world');
})

app.listen(port, () => {
    console.log(`Clean-Co-Server is running on port : ${port}`)
})




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1vp8pwf.mongodb.net/?retryWrites=true&w=majority`;

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

        const usersCollection = client.db('stayVistaDb').collection('users');

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // create token
        app.post('/jwt', async(req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
            .send({success: true})
        });

        // save user info in db
        app.put('/users/:email', async (req, res) => {

            const email = req.params.email;
            const user = req.body;
            const query = { email: email };
            const options = { upsert: true };
            const isExists = await usersCollection.findOne(query);

            if (isExists) return res.send(isExists);

            const result = await usersCollection.updateOne(
                query,
                {
                    $set: { ...user, timestamp: Date.now() }
                },
                options
            )
            res.send(result)
        })

        // clear cookie after logOut
        app.get('/logOut', async(req, res) => {
            try{
                res.clearCookie('token', {
                    maxAge: 0,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
                })
                .send({success: true})
            }
            catch(err){
                res.status(500).send(err)
            }
        })












        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
