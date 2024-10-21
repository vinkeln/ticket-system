import { transporter } from '../server.js'; // Importera transporter

const sendUpdateEmail = async (ticketOwnerEmail, ticketId, updateType) => {
    console.log(`Preparing to send email to ${ticketOwnerEmail} for ticket ${ticketId} update: ${updateType}`);
    
    const mailOptions = {
        from: process.env.EMAIL_USER, 
        to: ticketOwnerEmail,
        subject: `Your ticket has been ${updateType}`,
        text: `Your ticket with ID: ${ticketId} has been ${updateType}. Please visit the system for more details.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${ticketOwnerEmail}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

export { sendUpdateEmail };
