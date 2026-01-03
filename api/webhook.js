import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    console.log("Webhook:", JSON.stringify(data));

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

            // --- 1. PROSES USER PTERODACTYL ---
            // Kita jalankan ini DULUAN untuk mendapatkan Username Final (misal: caspertes80)
            let pteroResult = null;
            try {
                pteroResult = await ensurePteroUser({
                    email: orderData.email,
                    username: orderData.username,
                    password: orderData.password
                });
                
                // --- 2. BUAT SERVER ---
                // Gunakan pteroResult.id
                await createPteroServer(pteroResult.id, orderData.category, {
                    ram: orderData.ram || 1024,
                    cpu: orderData.cpu || 100,
                    disk: orderData.disk || 1000
                });
                
            } catch (err) {
                console.error("Gagal Ptero:", err);
                // Lanjut update firebase dulu biar status PAID tetap masuk walau server gagal
            }

            // --- 3. UPDATE FIREBASE (Status & Username Final) ---
            // Ini akan mentrigger Frontend untuk menampilkan username yang benar (caspertes80)
            await orderRef.update({ 
                status: 'PAID', 
                paidAt: new Date().toISOString(),
                payment_method: data.payment_method || 'qris',
                
                // Simpan URL Panel
                panel_url: process.env.PTERO_URL, 
                
                // [PENTING] Update Username di Database dengan hasil generate Ptero
                // Jika pteroResult ada, pakai username barunya. Jika gagal, pakai username lama.
                username: pteroResult ? pteroResult.username : orderData.username, 

                pakasir_data: data
            });

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Webhook Error:", error);
            return res.status(500).send('Internal Server Error');
        }
    }

    return res.status(200).send('Status ignored');
}
