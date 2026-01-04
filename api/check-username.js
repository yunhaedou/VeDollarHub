import { PTERO_CONFIG } from './config.js';

export default async function handler(req, res) {
    const { username } = req.query;
    if (!username) return res.json({ exists: false });

    try {
        const url = `${PTERO_CONFIG.domain}/api/application/users?filter[username]=${username}`;
        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PTERO_CONFIG.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const response = await fetch(url, options);
        const data = await response.json();

        // Jika array data > 0, berarti username sudah ada
        if (data.data && data.data.length > 0) {
            return res.json({ exists: true });
        }
        
        return res.json({ exists: false });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
