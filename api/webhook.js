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
            // Gunakan Transaction agar aman saat rebutan stok
            await db.runTransaction(async (t) => {
                const orderSnap = await t.get(orderRef);
                if (!orderSnap.exists) throw "Order not found";
                
                const orderData = orderSnap.data();
                if (orderData.status === 'PAID') return; // Sudah diproses

                const cat = orderData.category;
                const prodId = orderData.productId;
                
                let updateData = {
                    status: 'PAID',
                    paidAt: new Date().toISOString()
                };

                // --- 1. JIKA APP PREMIUM (AMBIL STOK) ---
                if (cat === 'app' && prodId) {
                    const prodRef = db.collection('products').doc(prodId);
                    const prodSnap = await t.get(prodRef);

                    if (prodSnap.exists) {
                        const currentStock = prodSnap.data().stock || [];
                        
                        if (currentStock.length > 0) {
                            // AMBIL STOK PERTAMA (FIFO)
                            const accountToSend = currentStock[0];
                            
                            // Hapus dari list (Shift)
                            const newStock = currentStock.slice(1);

                            // Update Database Produk (Kurangi Stok)
                            t.update(prodRef, { stock: newStock });

                            // Simpan Akun ke Order (Untuk ditampilkan ke user)
                            updateData.delivered_account = accountToSend;
                        } else {
                            updateData.delivered_account = "STOK HABIS SAAT PEMBAYARAN - HUBUNGI ADMIN";
                        }
                    }
                } 
                
                // --- 2. JIKA BOT WA/TG (CREATE SERVER) ---
                else if (cat === 'botwa' || cat === 'bottg') {
                    // Logic Pterodactyl (Biarkan berjalan di background setelah transaksi selesai)
                    // Kita set data panel URL nanti di luar blok transaction atau update sekarang
                    // Untuk simplisitas, kita trigger fungsinya tapi update DB dilakukan terpisah atau di sini
                    try {
                         const pteroResult = await ensurePteroUser({
                            email: orderData.email,
                            username: orderData.username,
                            password: orderData.password
                        });
                        
                        await createPteroServer(pteroResult.id, cat, {
                            ram: 1024, cpu: 100, disk: 1000
                        });

                        updateData.panel_url = process.env.PTERO_URL;
                        updateData.username = pteroResult.username;
                    } catch (err) {
                        console.error("Gagal Auto Create Server:", err);
                        // Tetap tandai PAID, nanti admin cek manual jika gagal
                    }
                }

                // Update Status Order Akhir
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
