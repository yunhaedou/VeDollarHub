import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    const orderId = data.order_id;
    const status = data.status; 

    if (!orderId) return res.status(400).send('No Order ID');

    if (status === 'completed' || status === 'success') {
        const orderRef = db.collection('orders').doc(orderId);
        
        try {
            await db.runTransaction(async (t) => {
                const orderSnap = await t.get(orderRef);
                if (!orderSnap.exists) throw "Order not found";
                
                const orderData = orderSnap.data();
                if (orderData.status === 'PAID') return; 

                const cat = orderData.category;
                const prodId = orderData.productId;
                
                let updateData = { status: 'PAID', paidAt: new Date().toISOString() };

                // 1. APP PREMIUM (POTONG STOK)
                if (cat === 'app' && prodId) {
                    const prodRef = db.collection('products').doc(prodId);
                    const prodSnap = await t.get(prodRef);

                    if (prodSnap.exists) {
                        const currentStock = prodSnap.data().stock || [];
                        if (currentStock.length > 0) {
                            const accountToSend = currentStock[0];
                            const newStock = currentStock.slice(1);
                            t.update(prodRef, { stock: newStock });
                            updateData.delivered_account = accountToSend;
                        } else {
                            updateData.delivered_account = "STOK HABIS SAAT PROSES. HUBUNGI ADMIN.";
                        }
                    }
                } 
                // 2. BOT HOSTING (AUTO CREATE)
                else if (cat === 'botwa' || cat === 'bottg') {
                    try {
                        // A. Buat User Panel & Dapat Username Final
                        const pteroUser = await ensurePteroUser({
                            email: orderData.email,
                            username: orderData.username,
                            password: orderData.password
                        });

                        // B. SIMPAN DATA PANEL KE DB (PENTING AGAR MUNCUL DI POPUP)
                        updateData.panel_url = process.env.PTERO_URL;
                        updateData.username = pteroUser.username; // Username hasil Ptero
                        updateData.password = orderData.password;

                        // C. Buat Server
                        let ram = 1024, cpu = 100, disk = 1000;
                        if(prodId) {
                            const pRef = db.collection('products').doc(prodId);
                            const pSnap = await t.get(pRef);
                            if(pSnap.exists) {
                                const pd = pSnap.data();
                                ram = pd.ram || 1024; cpu = pd.cpu || 100; disk = pd.disk || 1000;
                            }
                        }
                        await createPteroServer(pteroUser.id, cat, { ram, cpu, disk });

                    } catch (err) {
                        console.error("Gagal Create Ptero:", err);
                        // Data URL tetap tersimpan agar user bisa login manual jika server gagal
                    }
                }

                t.update(orderRef, updateData);
            });

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Webhook Error:", error);
            return res.status(500).send('Internal Server Error');
        }
    }
    return res.status(200).send('Ignored');
}
