import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';
import { orderGriez } from './utils/griez.js'; // Import Helper Baru

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    const orderId = data.order_id;
    const status = data.status; 

    if (!orderId) return res.status(400).send('No Order ID');

    // Cek status sukses dari Pakasir
    if (status === 'completed' || status === 'success') {
        const orderRef = db.collection('orders').doc(orderId);
        
        try {
            const orderSnap = await orderRef.get();
            if (!orderSnap.exists) return res.status(404).send('Order not found');
            
            const orderData = orderSnap.data();
            if (orderData.status === 'PAID') return res.status(200).send('Already Processed');

            // --- LOGIKA UTAMA: CEK KATEGORI ---
            const cat = orderData.category;
            let finalUsername = orderData.username; // Default

            // 1. JIKA KATEGORI HOSTING (Bot WA/TG)
            if (cat === 'botwa' || cat === 'bottg') {
                try {
                    const pteroResult = await ensurePteroUser({
                        email: orderData.email,
                        username: orderData.username,
                        password: orderData.password
                    });
                    
                    await createPteroServer(pteroResult.id, cat, {
                        ram: orderData.ram || 1024, cpu: 100, disk: 1000
                    });

                    finalUsername = pteroResult.username; // Update username jika dirandom
                } catch (err) {
                    console.error("Gagal Hosting:", err);
                }
            } 
            
            // 2. JIKA KATEGORI TOPUP (MLBB, Weekly, dll)
            else {
                try {
                    // Pastikan di database 'products' firebase, ada field 'service_code'
                    // Contoh: service_code: "ML86"
                    const serviceCode = orderData.service_code || "CEK_DB"; 
                    
                    await orderGriez(serviceCode, orderData.username); // username disini isinya Game ID
                    console.log("Sukses Topup Griez:", orderData.username);

                } catch (err) {
                    console.error("Gagal Topup:", err);
                }
            }

            // --- UPDATE STATUS DI DATABASE ---
            await orderRef.update({ 
                status: 'PAID', 
                paidAt: new Date().toISOString(),
                username: finalUsername, // Update jika hosting berubah
                panel_url: (cat === 'botwa' || cat === 'bottg') ? process.env.PTERO_URL : null
            });

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Webhook Error:", error);
            return res.status(500).send('Internal Server Error');
        }
    }

    return res.status(200).send('Ignored');
}
