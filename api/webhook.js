import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    const orderId = data.order_id || data.trx_id; 
    const status = data.status; 

    if (!orderId) return res.status(400).send('No Order ID');

    if (status === 'success' || status === 'paid' || status === 'settlement') {
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) return res.status(404).send('Order not found');
        const orderData = orderSnap.data();

        if (orderData.status === 'PAID') return res.status(200).send('Already Processed');

        try {
            await orderRef.update({ status: 'PAID', paidAt: new Date().toISOString() });

            const pteroUserId = await ensurePteroUser({
                email: orderData.email,
                username: orderData.username,
                password: orderData.password
            });

            // AMBIL SPEK DARI DATA ORDER
            const resources = {
                ram: orderData.ram || 1024,
                cpu: orderData.cpu || 100,
                disk: orderData.disk || 1000
            };
            
            // CREATE SERVER DENGAN SPEK TERSEBUT
            await createPteroServer(pteroUserId, orderData.category, resources);

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Failed:", error);
            return res.status(500).send('Provisioning Failed: ' + error.message);
        }
    }

    return res.status(200).send('OK');
}
