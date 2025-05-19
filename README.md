# Family Caregiving App

A comprehensive caregiver support application designed to streamline health management, emergency preparedness, and care coordination for families caring for loved ones.

## Features

- Multi-care recipient management with color coordination
- Comprehensive medication tracking with interaction warnings
- Health metrics monitoring (blood pressure, glucose, etc.)
- Calendar and appointment management
- Emergency information with security features
- Doctors and pharmacies tracking
- And much more

## Technology Stack

- Frontend: React + TypeScript with TailwindCSS
- Backend: Express.js
- Database: PostgreSQL with Drizzle ORM
- Authentication: PIN-based security for sensitive data

## Deployment Requirements

### Environment Variables

The following environment variables need to be set when deploying:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for encrypting sessions (can be any long random string)
- `PORT`: (Optional) Port to run the server on (defaults to 5000)

### For Render Deployment

1. Create a new Web Service
2. Connect your GitHub repository
3. Select "Node" as runtime
4. Set the build command: `npm install && npm run db:push && npm run build`
5. Set the start command: `npm start`
6. Add the required environment variables listed above
7. Create a PostgreSQL database service and link it to your web service

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your environment variables in a `.env` file
4. Initialize the database: `npm run db:push`
5. Start the development server: `npm run dev`

## License

This project is licensed under the MIT License - see the LICENSE file for details.