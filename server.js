import mysql from 'mysql2/promise';
import express from 'express'; // Import express
import multer from 'multer'; // Import multer
import path from 'path';
import fs from 'fs';
import { auth } from 'express-openid-connect';
import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer'; // ladda in mail
import { getArticles, createArticle, deleteArticleById } from './src/knowledgeBase.js'; // Importera funktioner från knowledgeBase.js
import { getStatuses } from './src/status.js'; // Importera getStatuses

const config = {
    authRequired: true,
    auth0Logout: true,
    secret: process.env.SECRET, // Använd en säker hemlighet
    baseURL: 'http://localhost:3000',
    clientID: 'cWTRgbAwfmZxqafWuBzg8FFTI8q2Ujvj',
    issuerBaseURL: 'https://dev-juq4f4z7tsy1kegn.us.auth0.com'
};
import { fileURLToPath } from 'url';
import { createTicket, getTicketById, classifyTicket, createCategory, getCategories} from './src/createTicket.js'; // Importera funktioner från createTicket.js

const app = express(); // Initialize the express app
const port = 3000; // Port to run the server on

// profile to auth0
/*const { requiresAuth } = require('express-openid-connect');

app.get('/profile', requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user));
});*/


app.use(express.static('public')); // Hanterar statiska filer (HTML, CSS, JS, bilder, etc)
app.use(express.json()); // Hanterar HTTP POST request från klienten
app.use(express.urlencoded({ extended: true })); // Hanterar HTTP POST request från klienten
// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // dirname är sökvägen till den nuvarande filen

app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "views"));

// Multer-konfiguration 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Var filerna ska sparas
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Ger filerna unika namn med tidsstämpel
    }
});

const upload = multer({ storage: storage });

// Ladda upp credentials från filen
let login = fs.readFileSync('./config/credentials.json', 'utf8');
let credentials = JSON.parse(login);

let db;

// Databasanslutning
async function initializePool() {
    try {
        db = await mysql.createPool(credentials);
        console.log('Database connection successful');
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }
};
//middleware för att kontrollera användarroll
const checkRole = (role) => (req, res, next) => {
    const userRoles = req.oidc.user['https://ticketsystem.com/roles'] || [];
    if (userRoles.includes(role)) {
        return next(); // Användaren har rätt roll, fortsätt
    }
    return res.status(403).send('Access denied'); // Användaren har inte rätt roll
};


// Anropa poolens initiering
initializePool();

// req.isAuthenticated is provided from the auth router
app.get('/login', (req, res) => {
    res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

// req.isAuthenticated is provided from the auth router
app.get('/profile', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        res.send(`Logged in as ${req.oidc.user.name}`);
    } else {
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    res.oidc.logout();
});

app.get('/callback', (req, res) => {
    res.redirect('/'); // Omdirigera till startsidan efter inloggning
});


// route för att skapa en kategori
app.get('/', async (req, res) => { // Hämta kategorier
    const categories = await getCategories();
    res.render('index', { categories, req }); // Skicka kategorier och användarroll till vyn // userrole == agent
});

// Route för att skapa en ny ticket och ladda upp en fil.
app.post('/ticket', checkRole('user'), upload.single('file'), async (req, res) => {
    // Hämta titel, beskrivning och kategori från formuläret
    const { title, description, category } = req.body;

    // Kontrollera om en fil har bifogats, om inte, sätt filen till null
    const file = req.file ? req.file.filename : null;

    try {
        // Skapa biljetten i databasen med titel, beskrivning, fil och kategori
        const ticketId = await createTicket(title, description, file, category);

        // Hämta den skapade biljetten för att visa på informationssidan
        const ticket = await getTicketById(ticketId);
        const statuses = await getStatuses();

        // Rendera en vy för att visa bekräftelse eller biljettdetaljer
        res.render('ticket', { ticket, statuses, req });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).send('Error creating ticket');
    }
});


// Route för att visa formuläret för att skapa en ny ticket
app.get('/tickets', async (req, res) => {
    const { category, status, description, startDate, endDate } = req.query;
    let query = `
        SELECT tickets.*, categories.name AS category_name, status.name AS status_name
        FROM tickets
        LEFT JOIN categories ON tickets.category_id = categories.id
        LEFT JOIN status ON tickets.status_id = status.id
        WHERE 1=1
    `;
    const queryParams = [];

    if (category) {
        query += ' AND tickets.category_id = ?';
        queryParams.push(category);
    }
    if (status) {
        query += ' AND tickets.status_id = ?';
        queryParams.push(status);
    }
    if (description) {
        query += ' AND tickets.description LIKE ?';
        queryParams.push(`%${description}%`);
    }
    if (startDate) {
        query += ' AND tickets.created_at >= ?';
        queryParams.push(startDate);
    }
    if (endDate) {
        query += ' AND tickets.created_at <= ?';
        queryParams.push(endDate);
    }

    try {
        // Hämta biljetterna och tillhörande kategorier och statusar
        const [tickets] = await db.query(query, queryParams);
        const categories = await getCategories();
        const statuses = await getStatuses();

        res.render('ticketList', { tickets, categories, statuses, req });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).send('Error fetching tickets');
    }
});


// Route för att visa en specifik ticket
/*app.get('/ticket/:id', async (req, res) => {
    const ticket = await getTicketById(req.params.id);
    const statuses = await getStatuses();
    console.log(statuses); 
    // Rendera ticketInfo.ejs med biljettens data och statusar
    res.render('ticketInfo', { ticket, statuses, req });
});*/
app.get('/ticket/:id', async (req, res) => {
    try {
        const ticket = await getTicketById(req.params.id);
        const statuses = await getStatuses();

        // Rendera ticketInfo.ejs med biljettens data, agent och kommentarer
        res.render('ticketInfo', { ticket, statuses, req });
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).send('Error fetching ticket');
    }
});


// Route för att uppdatera status på en biljett
app.post('/ticket/:id/status', async (req, res) => {
    const ticketId = req.params.id;
    const { status } = req.body; // Hämta vald status från formuläret

    try {
        // Uppdatera status för den specifika biljetten
        await db.query('UPDATE tickets SET status_id = ? WHERE id = ?', [status, ticketId]);
        res.redirect(`/ticket/${ticketId}`); // Omdirigera tillbaka till biljettsidan
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).send('Error updating status');
    }
});


app.get('/tickets', async (req, res) => {
    const { category, status, description, startDate, endDate } = req.query;
    let query = `
        SELECT tickets.*, categories.name AS category_name, status.name AS status_name
        FROM tickets
        LEFT JOIN categories ON tickets.category_id = categories.id
        LEFT JOIN status ON tickets.status_id = status.id
        WHERE 1=1
    `;
    const queryParams = [];

    if (category) {
        query += ' AND tickets.category_id = ?';
        queryParams.push(category);
    }
    if (status) {
        query += ' AND tickets.status_id = ?';
        queryParams.push(status);
    }
    if (description) {
        query += ' AND tickets.description LIKE ?';
        queryParams.push(`%${description}%`);
    }
    if (startDate) {
        query += ' AND tickets.created_at >= ?';
        queryParams.push(startDate);
    }
    if (endDate) {
        query += ' AND tickets.created_at <= ?';
        queryParams.push(endDate);
    }

    try {
        // Hämta biljetterna
        const [tickets] = await db.query(query, queryParams);
        const categories = await getCategories(); // Hämta kategorier
        const statuses = await getStatuses(); // Hämta statusar

        // Rendera ticketList.ejs med biljetter, kategorier och statusar
        res.render('ticketList', { tickets, categories, statuses, req });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).send('Error fetching tickets');
    }
});

app.get('/categories/create', checkRole('agent'), async (req, res) => {
    res.render('createCategory', { req });
});

app.post('/categories/create', async (req, res) => {
    const { name } = req.body;
    await createCategory(name);
    res.redirect('/'); //startsidan
});


app.get('/knowledge-base/create', (req, res) => {
    if (req.oidc.isAuthenticated() && req.oidc.user['https://ticketsystem.com/roles'].includes('agent')) {
        res.render('createArticle', { req }); // Skicka med req här
    } else {
        res.status(403).send('Access denied'); // Endast agenter kan skapa artiklar
    }
});


// Route för att hantera inskickad artikeldata
app.post('/knowledge-base/create', async (req, res) => {
    const { title, content } = req.body;
    const agentId = req.oidc.user.sub; // Hämta agentens ID från den inloggade användaren

    try {
        await createArticle(title, content, agentId);
        res.redirect('/knowledge-base'); // Omdirigera till kunskapsbasens huvudvy
    } catch (error) {
        console.error('Fel vid skapandet av artikeln:', error); // Logga det exakta felet
        res.status(500).send('Fel uppstod vid skapandet av artikeln');
    }
});

// Route för att ta bort en artikel (endast för agenter)
app.post('/knowledge-base/:id/delete', async (req, res) => {
    const articleId = req.params.id;

    try {
        await deleteArticleById(articleId);
        res.redirect('/knowledge-base'); // Omdirigera tillbaka till kunskapsbasen efter borttagning
    } catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).send('Error deleting article');
    }
});

// Route för att lista och söka artiklar
app.get('/knowledge-base', async (req, res) => {
    const search = req.query.search || ''; // Hämta söksträngen från queryparametern
    const articles = await getArticles(search);
    res.render('knowledgeBase', { articles, req });
});

app.post('/ticket/:id/add-comment', async (req, res) => {
    const ticketId = req.params.id;
    const { comment } = req.body;
    const userId = req.oidc.user.sub; // Hämta användarens ID (om du använder Auth0)

    try {
        const query = 'INSERT INTO comments (ticket_id, user_id, comment) VALUES (?, ?, ?)';
        await db.query(query, [ticketId, userId, comment]);

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).send('Error adding comment');
    }
});

app.post('/ticket/:id/delete-comment', async (req, res) => {
    const commentId = req.body.commentId;
    const ticketId = req.params.id;

    try {
        const query = 'DELETE FROM comments WHERE id = ?';
        await db.query(query, [commentId]);

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).send('Error deleting comment');
    }
});



// Starta servern
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
