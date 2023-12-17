const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = 5000;
require('dotenv').config();

// middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('hello world');
})

app.listen(port, () => {
    console.log(`Stay-Vista is running on port : ${port}`)
})

// verify user / token
const verifyToken = async (req, res, next) => {
    const token = req?.cookies?.token;
    console.log('received token', token);

    if (!token) {
        console.log('no token found');
        return res.status(401).send({ message: 'UnAuthorized User' });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log('token verification failed', err);
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.user = decoded;
        console.log('token verified :', decoded);
        next();
    })
}




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
        const roomsCollection = client.db('stayVistaDb').collection('rooms');

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // create token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ success: true })
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
        app.get('/logOut', async (req, res) => {
            try {
                res.clearCookie('token', {
                    maxAge: 0,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
                })
                    .send({ success: true })
            }
            catch (err) {
                res.status(500).send(err)
            }
        })

        // rooms related api
        app.get('/rooms', async (req, res) => {
            const result = await roomsCollection.find().toArray();
            res.send(result);
        })

        app.get('/room/:id', async (req, res) => {
            const id = req.params.id;
            const result = await roomsCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        app.post('/rooms', verifyToken, async (req, res) => {
            const room = req.body;
            const result = await roomsCollection.insertOne(room);
            res.send(result);
        })

        app.get('/rooms/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const result = await roomsCollection.find({ 'host.email': email }).toArray();
            res.send(result);
        })


        // user related api
        // get user role
        app.get('/user/:email', async(req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({email});
            res.send(result);
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
