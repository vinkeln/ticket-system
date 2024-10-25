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
import { sendUpdateEmail } from './src/email.js'; // import sendUpdateEmail
const app = express(); // Initialize the express app
const port = 3000; // Port to run the server on


const config = {
    authRequired: true,
    auth0Logout: true,
    secret: process.env.SECRET, // Hämta hemligheten från .env
    baseURL: process.env.BASEURL, // Hämta baseURL från .env
    clientID: process.env.CLIENTID, // Hämta clientID från .env
    issuerBaseURL: process.env.ISSURER // Hämta issuerBaseURL från .env
};

import { fileURLToPath } from 'url';
import { createTicket, getTicketById, classifyTicket, createCategory, getCategories} from './src/createTicket.js'; // Importera funktioner från createTicket.js


// Definiera transporter för att skicka e-post via en SMTP-server
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Testa anslutningen (kan tas bort senare om det fungerar)
transporter.verify(function(error, success) {
    if (error) {
        console.log('Error connecting to email server:', error);
    } else {
        console.log('Server is ready to take our messages');
    }
});


app.use(express.static('public')); // Hanterar statiska filer (HTML, CSS, JS, bilder, etc)
app.use(express.json()); // Hanterar HTTP POST request från klienten
app.use(express.urlencoded({ extended: true })); // Hanterar HTTP POST request från klienten
// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // dirname är sökvägen till den nuvarande filen

// Middleware för att kontrollera och tilldela roller
app.use(async (req, res, next) => {
    if (req.oidc.isAuthenticated()) {
        const user = req.oidc.user;
        const userRoles = user[`https://ticketsystem.com/roles`] || [];

        if (userRoles.length === 0) {
            const userId = user.sub;

            try {
                // Kontrollera om användaren redan har en roll i lokala databasen
                const [results] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);

                if (results.length > 0) {
                    res.locals.user = {
                        email: user.email,
                        role: results[0].role // Använd rollen från databasen
                    };
                    return next();
                }

                // Om ingen roll finns, tilldela "user" som standardroll
                const insertRoleQuery = 'INSERT INTO users (id, email, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = ?';
                await db.query(insertRoleQuery, [userId, user.email, 'user', 'user']);
                res.locals.user = { email: user.email, role: 'user' };
                console.log('Default role "user" assigned successfully');
                next();
            } catch (error) {
                console.error("Error checking or assigning roles:", error);
                next(error);
            }
        } else {
            // Om användaren har en roll i Auth0, använd den
            const role = userRoles.includes('agent') ? 'agent' : 'user';
            res.locals.user = { email: user.email, role: role };
            next();
        }
    } else {
        res.locals.user = null;
        next();
    }
});


app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "views"));

// Multer-konfiguration 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Var filerna ska sparas
    },
    filename: (req, file, cb) => {
        // Ta bort eller ersätt svenska bokstäver och specialtecken
        const sanitizedFilename = file.originalname
            .replace(/å/g, 'a')
            .replace(/Å/g, 'A')
            .replace(/ä/g, 'a')
            .replace(/Ä/g, 'A')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'O')
            .replace(/[^\w\-\.]/g, ''); // Tar bort andra ogiltiga tecken
        cb(null, `${Date.now()}-${sanitizedFilename}`);
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
const checkRole = (...roles) => (req, res, next) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).render('accessDenied');
    }

    const userRolesFromAuth0 = req.oidc.user[`https://ticketsystem.com/roles`] || [];
    const userRoleFromDb = res.locals.user ? res.locals.user.role : null;

    console.log('Auth0 roles:', userRolesFromAuth0);
    console.log('Role from database:', userRoleFromDb);

    const combinedRoles = new Set([...userRolesFromAuth0, userRoleFromDb]);

    const hasRequiredRole = roles.some(role => combinedRoles.has(role));

    if (hasRequiredRole) {
        console.log('User has required role:', roles);
        return next();
    }

    console.log('Access denied for roles:', roles);
    return res.status(403).send('Access denied');
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


app.post('/ticket', checkRole('user', 'agent'), upload.single('file'), async (req, res) => {
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
        const query = `INSERT INTO tickets (title, description, category_id, files, user_id, team_id, is_viewed)    
        VALUES (?, ?, ?, ?, ?, ?, 0)`;
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


app.get('/tickets', async (req, res) => {
    const { category, status, description, startDate, endDate } = req.query;
    let query = `
        SELECT tickets.*, 
               categories.name AS category_name, 
               status.name AS status_name, 
               users.name AS agent_name, 
               teams.name AS team_name,
               tickets.is_viewed
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
        const [tickets] = await db.query(query, queryParams);
        console.log('Fetched tickets:', tickets); // Logga resultaten här
        const categories = await getCategories();
        const statuses = await getStatuses();

        res.render('ticketList', { tickets, categories, statuses, req });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).send('Error fetching tickets');
    }
});


app.get('/ticket/:id', async (req, res) => {
    const ticketId = req.params.id;

    try {
        // Försök att uppdatera biljetten till "sedd"
        const updateResult = await db.query('UPDATE tickets SET is_viewed = 1 WHERE id = ?', [ticketId]);
        console.log('Update result:', updateResult); // Kontrollera om uppdateringen lyckas

        const query = `
            SELECT tickets.*, 
                   categories.name AS category_name, 
                   status.name AS status_name, 
                   ticket_user.email AS user_email, 
                   ticket_user.name AS user_name, 
                   teams.name AS team_name, 
                   comments.comment, 
                   comments.created_at AS comment_date, 
                   comments.user_id AS commenter_email
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

        console.log('Fetched ticket:', ticket); // Kontrollera om is_viewed hämtas korrekt

        res.render('ticketInfo', { ticket, statuses, categories, req });
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).send('Error fetching ticket');
    }
});

app.post('/ticket/:id/add-comment', async (req, res) => {
    const ticketId = req.params.id;
    const { comment } = req.body;
    const userEmail = req.oidc.user.email;

    try {
        // Lägg till kommentaren
        await db.query('INSERT INTO comments (ticket_id, user_id, comment, created_at) VALUES (?, ?, ?, NOW())', [ticketId, userEmail, comment]);

        // Hämta användarens e-post som skapade biljetten
        const [ticketOwner] = await db.query('SELECT user_id FROM tickets WHERE id = ?', [ticketId]);

        // Skicka e-post
        await sendUpdateEmail(ticketOwner[0].user_id, ticketId, 'commented');

        // Uppdatera is_viewed
        await db.query('UPDATE tickets SET is_viewed = 0 WHERE id = ?', [ticketId]);

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).send('Error adding comment');
    }
});




// Route för att uppdatera status på en biljett
app.post('/ticket/:id/status', async (req, res) => {
    const ticketId = req.params.id;
    const { status } = req.body;

    try {
        // Uppdatera status
        await db.query('UPDATE tickets SET status_id = ?, is_viewed = 0 WHERE id = ?', [status, ticketId]);

        // Hämta användarens e-post som skapade biljetten
        const [ticketOwner] = await db.query('SELECT user_id FROM tickets WHERE id = ?', [ticketId]);

        // Skicka e-post
        await sendUpdateEmail(ticketOwner[0].user_id, ticketId, 'status updated');

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).send('Error updating status');
    }
});



// Route för att uppdatera en biljetts kategori och tillhörande team
app.post('/ticket/:id/category', async (req, res) => {
    const ticketId = req.params.id;
    const categoryId = req.body.category;

    try {
        const teamId = await findTeamByCategory(categoryId);

        // Uppdatera biljetten med ny kategori och team
        await db.query('UPDATE tickets SET category_id = ?, team_id = ?, is_viewed = 0 WHERE id = ?', [categoryId, teamId, ticketId]);

        // Hämta användarens e-post som skapade biljetten
        const [ticketOwner] = await db.query('SELECT user_id FROM tickets WHERE id = ?', [ticketId]);

        // Skicka e-post
        await sendUpdateEmail(ticketOwner[0].user_id, ticketId, 'category updated');

        res.redirect(`/ticket/${ticketId}`);
    } catch (error) {
        console.error('Error updating ticket category and team:', error);
        res.status(500).send('Error updating ticket category and team');
    }
});



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

app.get('/categories/create', checkRole('agent'), async (req, res) => {
    res.render('createCategory', { req });
});

app.post('/categories/create', checkRole('agent'), async (req, res) => {
    const { name } = req.body;

    try {
        await createCategory(name);
        res.redirect('/'); // Omdirigera till startsidan efter att kategorin skapats
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).send('Error creating category');
    }
});



app.get('/knowledge-base/create', checkRole('agent'), async (req, res) => {
    try {
        // Kontrollera om användaren är autentiserad via Auth0
        if (req.oidc.isAuthenticated()) {
            // Hämta roller från Auth0
            const auth0Roles = req.oidc.user['https://ticketsystem.com/roles'] || [];

            // Kontrollera om användaren har rollen 'agent' via Auth0
            if (auth0Roles.includes('agent')) {
                return res.render('createArticle', { req });
            }

            // Om användaren inte har rollen via Auth0, kontrollera databasen
            const [results] = await db.query('SELECT role FROM users WHERE id = ?', [req.oidc.user.sub]);
            
            // Om användarens roll är 'agent' i databasen
            if (results.length > 0 && results[0].role === 'agent') {
                return res.render('createArticle', { req });
            }

            // Om ingen av källorna (Auth0 eller databasen) har agentrollen, neka åtkomst
            res.status(403).send('Access denied');
        } else {
            // Om användaren inte är inloggad, neka åtkomst
            res.status(401).send('You need to be authenticated to access this resource');
        }
    } catch (error) {
        console.error('Error checking roles or database:', error);
        res.status(500).send('Internal server error');
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

app.post('/switch-role', async (req, res) => {
    const userId = req.oidc.user.sub;
    const newRole = req.body.newRole;
    console.log('Received role:', req.body.newRole); // Logga vilken roll som skickas från formuläret


    if (!['user', 'agent'].includes(newRole)) {
        return res.status(400).send('Invalid role');
    }

    console.log(`Switching role for user ${userId} to ${newRole}`); // Logga användarens ID och nya roll

    try {
        // Uppdatera användarens roll i databasen
        const query = 'UPDATE users SET role = ? WHERE id = ?';
        await db.query(query, [newRole, userId]);

        // Uppdatera res.locals.user så att ändringen reflekteras
        res.locals.user = { email: req.oidc.user.email, role: newRole };
        console.log('Updated user role:', res.locals.user); // Logga den uppdaterade rollen

        res.redirect('/');
    } catch (error) {
        console.error('Error switching role:', error);
        res.status(500).send('Error switching role');
    }
});


// Starta servern
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;