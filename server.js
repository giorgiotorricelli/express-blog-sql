import express from 'express';
import router from './routers/postsRouter.js';
import notFound from './middlewares/notFound.js';

const app = express();

const server_port = process.env.SERVER_PORT;
app.use(express.json());
app.use(express.urlencoded());
app.use('/posts' , router); 





app.use(notFound);

app.listen(server_port, (error) => {
    if (error) {
        console.error(`ERRORE: la porta ${server_port} è già in utilizzo`);
        return;
    }

    console.log(`Messo in ascolto sulla porta ${server_port}`);
    
})