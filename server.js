import mysql from 'mysql2/promise';
import express from 'express'; // Import express
import multer from 'multer'; // Import multer
import path from 'path';
import fs from 'fs';
import { auth } from 'express-openid-connect';
import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer'; // ladda in mail
import { getArticles, createArticle, deleteArticleById, getArticleById } from './src/knowledgeBase.js'; // Importera funktioner från knowledgeBase.js
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
const checkRole = (allowedRoles) => (req, res, next) => {
    if (!Array.isArray(allowedRoles)) {
        return res.status(500).send('Roles must be an array'); // Kontrollera att allowedRoles är en array
    }

    const userRoles = req.oidc.user['https://ticketsystem.com/roles'] || [];
    
    if (allowedRoles.some(role => userRoles.includes(role))) {
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
/*app.post('/ticket', checkRole('user'), upload.single('file'), async (req, res) => {
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
});*/

app.post('/ticket', checkRole(['user', 'agent']), upload.single('file'), async (req, res) => {
    // Hämta titel, beskrivning och kategori från formuläret
    const { title, description, category } = req.body;

    // Kontrollera om en fil har bifogats, om inte, sätt filen till null
    const file = req.file ? req.file.filename : null;

    // Hämta användarens e-post (eller ID)
    const userEmail = req.oidc.user.email;  // Om du vill spara e-post
    const userId = req.oidc.user.sub;       // Om du vill spara Auth0-ID

    try {
        const teamId = await findTeamByCategory(category);

        // Spara biljetten i databasen med användarens e-post eller ID
        const query = `INSERT INTO tickets (title, description, category_id, files, user_id, team_id) 
        VALUES (?, ?, ?, ?, ?, ?)`;
        await db.query(query, [title, description, category, file, userEmail, teamId]);

        // Omdirigera eller visa bekräftelse
        res.redirect('/tickets'); // Ändra om du vill visa biljettens detaljer direkt
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).send('Error creating ticket');
    }
});


// Funktion för att hitta teamet baserat på kategorin
// ändrad av J.L
async function findTeamByCategory(categoryId) {
    const query = `
        SELECT t.id AS team_id 
        FROM categories c
        LEFT JOIN teams t ON c.team_id = t.id
        WHERE c.id = ?
    `;

    const [rows] = await db.query(query, [categoryId]);
    
    if (rows.length > 0 && rows[0].team_id) {
        return rows[0].team_id;
    } else {
        // Om kategorin inte har ett team eller inte finns, sätt till 'Other' team_id
        const [otherTeam] = await db.query("SELECT id FROM teams WHERE name = 'Other'");
        return otherTeam[0].id;
    }
}


// Route för att uppdatera en biljetts kategori och tillhörande team
app.post('/ticket/:id/category', async (req, res) => {
    const ticketId = req.params.id;
    const categoryId = req.body.category; // Hämta kategori-ID från formuläret

    try {
        // Hitta teamet baserat på den nya kategorin
        const teamId = await findTeamByCategory(categoryId);

        // Uppdatera biljetten med den nya kategorin och teamet
        await db.query('UPDATE tickets SET category_id = ?, team_id = ? WHERE id = ?', [categoryId, teamId, ticketId]);

        // Omdirigera tillbaka till ticket-sidan eller där du vill visa den uppdaterade biljetten
        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error updating ticket category and team:', error);
        res.status(500).send('Error updating ticket category and team');
    }
});





// Route för att visa formuläret för att skapa en ny ticket
app.get('/tickets', async (req, res) => {
    const { category, status, description, startDate, endDate } = req.query;
    let query = `
        SELECT tickets.*, 
               categories.name AS category_name, 
               status.name AS status_name, 
               users.name AS agent_name, 
               teams.name AS team_name
        FROM tickets
        LEFT JOIN categories ON tickets.category_id = categories.id
        LEFT JOIN status ON tickets.status_id = status.id
        LEFT JOIN users ON tickets.agent_id = users.id
        LEFT JOIN teams ON tickets.team_id = teams.id
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
    query += ' ORDER BY tickets.created_at DESC';

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
        const ticketId = req.params.id;

        const query = `
            SELECT tickets.*, 
                   categories.name AS category_name, 
                   status.name AS status_name, 
                   ticket_user.email AS user_email, 
                   ticket_user.name AS user_name, 
                   teams.name AS team_name, 
                   comments.comment, 
                   comments.created_at AS comment_date, 
                   comments.user_id AS commenter_email -- Vi använder user_id som nu är e-post
            FROM tickets
            LEFT JOIN categories ON tickets.category_id = categories.id
            LEFT JOIN status ON tickets.status_id = status.id
            LEFT JOIN users AS ticket_user ON tickets.user_id = ticket_user.id
            LEFT JOIN teams ON tickets.team_id = teams.id
            LEFT JOIN comments ON tickets.id = comments.ticket_id
            WHERE tickets.id = ?
        `;

        const [ticket] = await db.query(query, [ticketId]);
        const statuses = await getStatuses();
        const categories = await getCategories();

        console.log(ticket);  // Logga resultatet

        res.render('ticketInfo', { ticket, statuses, categories, req });
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).send('Error fetching ticket');
    }
});

/*app.get('/ticket/:id', async (req, res) => {
    const ticketId = req.params.id;

    try {
        const query = `
            SELECT tickets.*, categories.name AS category_name, status.name AS status_name, users.name AS agent_name
            FROM tickets
            LEFT JOIN categories ON tickets.category_id = categories.id
            LEFT JOIN status ON tickets.status_id = status.id
            LEFT JOIN users ON tickets.agent_id = users.id
            WHERE tickets.id = ?
        `;
        
        const [ticket] = await db.query(query, [ticketId]);
        const statuses = await getStatuses();

        console.log(ticket); // Lägg till denna rad för att se vad som hämtas
        res.render('ticketInfo', { ticket, statuses, req });
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).send('Error fetching ticket');
    }
});*/

app.post('/ticket/:id/add-comment', async (req, res) => {
    const ticketId = req.params.id;
    const { comment } = req.body;
    const userEmail = req.oidc.user.email; // Hämta inloggad användares e-post

    try {
        // Uppdatera query för att inkludera e-post istället för user_id
        const query = 'INSERT INTO comments (ticket_id, user_id, comment, created_at) VALUES (?, ?, ?, NOW())';
        await db.query(query, [ticketId, userEmail, comment]);

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).send('Error adding comment');
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

// kontrollera om denna behövs innan du tar bort
/*app.get('/tickets', async (req, res) => {
    const { category, status, description, startDate, endDate } = req.query;
    let query = `
        SELECT tickets.*, categories.name AS category_name, status.name AS status_name
        FROM tickets
        LEFT JOIN categories ON tickets.category_id = categories.id
        LEFT JOIN status ON tickets.status_id = status.id
        WHERE 1=1
    `;
    query += ' ORDER BY tickets.created_at DESC';
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
});*/

app.get('/ticket/:id', async (req, res) => {
    try {
        const ticket = await getTicketById(req.params.id);
        const statuses = await getStatuses();

        // Logga användarens information för att se roller
        console.log('Logged-in user:', req.oidc.user);

        // Rendera sidan med biljetten och statusar
        res.render('ticketInfo', { ticket, statuses, req });
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).send('Error fetching ticket');
    }
});


// Route för att tilldela agent till biljett (Take Responsibility)
app.post('/ticket/:id/assign-agent', async (req, res) => {
    const ticketId = req.params.id;
    const agentId = req.oidc.user.sub; // Hämta agentens Auth0 ID

    // Logga ticketId och agentId för att säkerställa att de är korrekt ifyllda
    console.log('Ticket ID:', ticketId);
    console.log('Agent ID:', agentId);

    try {
        const query = 'UPDATE tickets SET agent_id = ? WHERE id = ?';
        const [result] = await db.query(query, [agentId, ticketId]);

        // Logga resultatet av SQL-uppdateringen för att se om den lyckades
        console.log('Update result:', result);

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error assigning agent to ticket:', error);
        res.status(500).send('Error assigning agent to ticket');
    }
    console.log('Auth0 user object:', req.oidc.user);

});

app.use((req, res, next) => {
    if (req.method === 'POST') {
        console.log(`POST request to ${req.url}`);
    }
    next();
});





app.get('/categories/create', checkRole(['agent']), async (req, res) => {
    res.render('createCategory', { req });
});

app.post('/categories/create', checkRole(['agent']), async (req, res) => {
    const { name } = req.body;

    try {
        await createCategory(name);
        res.redirect('/'); // Omdirigera till startsidan efter att kategorin skapats
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).send('Error creating category');
    }
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

app.get('/knowledge-base/:id', async (req, res) => {
    const articleId = req.params.id;

    try {
        const article = await getArticleById(articleId); // Hämta artikeln baserat på dess ID
        res.render('articleDetails', { article, req }); // Skicka artikeln till vyn
    } catch (error) {
        console.error('Error fetching article:', error);
        res.status(500).send('Error fetching article');
    }
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

/*app.post('/ticket/:id/delete-comment', async (req, res) => {
    const commentId = req.body.commentId;  // Kommer från hidden input i formuläret
    const ticketId = req.params.id;  // Kommer från URL:en

    console.log(`Comment ID to delete: ${commentId}`); // Kontrollera att rätt ID skickas
    console.log(`Ticket ID: ${ticketId}`);  // Kontrollera att rätt ticket-id skickas

    try {
        const query = 'DELETE FROM comments WHERE id = ?';
        const result = await db.query(query, [commentId]);

        if (result.affectedRows === 0) {
            console.error(`Comment with ID ${commentId} not found`);
            res.status(404).send('Comment not found');
        } else {
            console.log(`${result.affectedRows} comment(s) deleted`);
            res.redirect(`/ticket/${ticketId}`);
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).send('Error deleting comment');
    }
});*/


// Starta servern
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
