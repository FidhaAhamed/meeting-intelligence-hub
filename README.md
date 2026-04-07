# Meeting Intelligence Hub

## Overview
The Meeting Intelligence Hub project aims to provide tools and insights to enhance meeting productivity through AI-driven analytics and features.

## Tech Stack
- **Frontend:** React.js, Redux, Bootstrap
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Deployment:** Kubernetes, Docker
- **Monitoring:** Prometheus, Grafana

## Setup Instructions
1. **Clone the repository:**  
   ```bash
   git clone https://github.com/<your_username>/meeting-intelligence-hub.git
   cd meeting-intelligence-hub
   ```

2. **Install dependencies:**  
   For the frontend:  
   ```bash
   cd frontend  
   npm install
   ```  
   For the backend:  
   ```bash
   cd backend  
   npm install
   ```

3. **Environment Variables:**  
   Create a `.env` file in the root of the backend directory and add the following:
   ```plaintext
   MONGODB_URI=<your_mongodb_uri>
   JWT_SECRET=<your_jwt_secret>
   PORT=5000
   ```

4. **Run the application:**  
   For the backend:  
   ```bash
   cd backend  
   npm start
   ```  
   For the frontend:  
   ```bash
   cd frontend  
   npm start
   ```

## Features
- **Meeting Notes:** Capture and store notes during meetings.
- **Action Items:** Create and track action items assigned during meetings.
- **Analytics Dashboard:** View analytics on meeting metrics.

## API Endpoints
### Authentication
- `POST /api/auth/register`: Register a new user  
- `POST /api/auth/login`: Log in an existing user

### Meetings
- `GET /api/meetings`: Get a list of meetings  
- `POST /api/meetings`: Create a new meeting  
- `GET /api/meetings/:id`: Get details of a specific meeting

### Notes
- `POST /api/meetings/:id/notes`: Add notes to a meeting  
- `GET /api/meetings/:id/notes`: Get notes for a meeting

### Action Items
- `POST /api/meetings/:id/action-items`: Create a new action item  
- `GET /api/meetings/:id/action-items`: Get action items for a meeting

## Contribution
Contributions are welcome! Please submit a pull request or open an issue for any improvements or suggestions.