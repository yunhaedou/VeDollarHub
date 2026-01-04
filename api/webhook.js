import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer, setServerStatus } from './utils/ptero.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const data = req.body;
    
    if (data.status === 'completed' || data.status === 'success') {
        const orderRef = db.collection('orders').doc(data.order_id);
        
        try {
            await db.runTransaction(async (t) => {
                const snap = await t.get(orderRef);
                const order = snap.data();
                if (order.status === 'PAID') return;

                // --- 1. RENEW SERVER (UNSUSPEND) ---
                if (order.type === 'renew' && order.renewTarget) {
                    const subRef = db.collection('active_subs').doc(order.renewTarget);
                    const subSnap = await t.get(subRef);
                    
                    if (subSnap.exists) {
                        const subData = subSnap.data();
                        // Panggil Ptero API Unsuspend
                        await setServerStatus(subData.ptero_server_id, 'unsuspend');
                        
                        // Tambah Expired 30 Hari
                        const newExp = new Date();
                        newExp.setDate(newExp.getDate() + 30);
                        
                        t.update(subRef, { status: 'ACTIVE', expiredAt: newExp.toISOString() });
                    }
                }
                
                // --- 2. ORDER BARU ---
                else {
                    // Logic App Premium (Stok)
                    if (order.category === 'app') {
                        const prodRef = db.collection('products').doc(order.productId);
                        const prodSnap = await t.get(prodRef);
                        if(prodSnap.exists) {
                            const stock = prodSnap.data().stock || [];
                            if(stock.length>0) {
                                t.update(prodRef, {stock: stock.slice(1)});
                                t.update(orderRef, {delivered_account: stock[0]});
                                
                                // Simpan ke Riwayat (active_subs) juga biar user bisa lihat akunnya
                                const subRef = db.collection('active_subs').doc();
                                t.set(subRef, {
                                    web_uid: order.web_uid,
                                    username: order.product, // Nama Produk
                                    password: stock[0], // Data Akun
                                    category: 'app',
                                    expiredAt: new Date().toISOString()
                                });
                            }
                        }
                    } 
                    // Logic Bot Hosting
                    else if (['botwa', 'bottg'].includes(order.category)) {
                        // Generate Email Internal agar tidak tabrakan dengan user lain
                        const internalEmail = `${order.username}@vedollar.id`;
                        
                        const pteroUser = await ensurePteroUser({
                            email: internalEmail,
                            username: order.username,
                            password: order.password
                        });

                        // Create Server
                        const srv = await createPteroServer(pteroUser.id, order.category, {ram:1024, cpu:100, disk:1000});

                        // Simpan Data Langganan (PENTING: Simpan WEB_UID)
                        const exp = new Date(); exp.setDate(exp.getDate() + 30);
                        const subRef = db.collection('active_subs').doc(); // Auto ID
                        
                        t.set(subRef, {
                            web_uid: order.web_uid, // ID Akun Web
                            username: pteroUser.username,
                            password: order.password,
                            ptero_server_id: srv.id,
                            category: order.category,
                            status: 'ACTIVE',
                            expiredAt: exp.toISOString()
                        });
                        
                        t.update(orderRef, { panel_url: process.env.PTERO_URL });
                    }
                }

                t.update(orderRef, { status: 'PAID', paidAt: new Date().toISOString() });
            });
            return res.status(200).json({success:true});
        } catch(e) { console.log(e); return res.status(500).send('Err'); }
    }
    return res.status(200).send('OK');
}
