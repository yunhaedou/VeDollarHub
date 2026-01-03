import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    console.log("Webhook Masuk:", JSON.stringify(data));

    const orderId = data.order_id;
    const status = data.status; 

    if (!orderId) return res.status(400).send('No Order ID');

    if (status === 'completed' || status === 'success') {
        const orderRef = db.collection('orders').doc(orderId);
        
        try {
            const orderSnap = await orderRef.get();
            if (!orderSnap.exists) return res.status(404).send('Order not found');
            
            const orderData = orderSnap.data();
            if (orderData.status === 'PAID') return res.status(200).send('Already Processed');

            // --- UPDATE STATUS & SIMPAN URL PANEL ---
            await orderRef.update({ 
                status: 'PAID', 
                paidAt: new Date().toISOString(),
                payment_method: data.payment_method || 'qris',
                
                // INI KUNCINYA: Simpan URL dari Variabel Vercel ke Database
                panel_url: process.env.PTERO_URL, 
                
                pakasir_data: data
            });

            // --- PROSES PEMBUATAN SERVER ---
            try {
                const pteroUserId = await ensurePteroUser({
                    email: orderData.email,
                    username: orderData.username,
                    password: orderData.password
                });

                const resources = {
                    ram: orderData.ram || 1024,
                    cpu: orderData.cpu || 100,
                    disk: orderData.disk || 1000
                };
                
                await createPteroServer(pteroUserId, orderData.category, resources);
                console.log("Server Created!");
                
            } catch (pteroError) {
                console.error("GAGAL AUTO-CREATE SERVER:", pteroError);
            }

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Webhook Error:", error);
            return res.status(500).send('Internal Server Error');
        }
    }

    return res.status(200).send('Status ignored');
}
