import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Ambil semua data yang dikirim dari Frontend
    const payload = req.body;
    const { category, productId, price, product, username, email } = payload;

    try {
        // --- 1. CEK STOK KHUSUS APP PREMIUM (DIKEMBALIKAN) ---
        // Kita wajib cek stok sebelum bikin QRIS agar user tidak bayar zonk
        if (category === 'app' && productId) {
            const prodRef = db.collection('products').doc(productId);
            const prodSnap = await prodRef.get();
            
            if (!prodSnap.exists) return res.status(404).json({ error: "Produk tidak ditemukan" });
            
            const prodData = prodSnap.data();
            // Cek apakah array stock ada isinya
            if (!prodData.stock || prodData.stock.length === 0) {
                return res.status(400).json({ error: "Maaf, Stok Habis! Silakan hubungi admin." });
            }
        }

        // --- 2. PROSES PEMBUATAN QRIS ---
        const orderId = `ORD-${Date.now()}`;

        const pakasir = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: process.env.PAKASIR_API_KEY,
                project: process.env.PAKASIR_PROJECT_ID,
                amount: parseInt(price),
                order_id: orderId,
                description: product,
                payment_method: "qris",
                customer_name: username || "User",
                customer_email: email || "user@vedollar.id",
                customer_phone: "080000000000" // Dummy phone required by gateway
            })
        });

        const result = await pakasir.json();

        // Ambil string QR dari respon Pakasir
        let qrString = null;
        if (result.data?.qr_string) qrString = result.data.qr_string;
        else if (result.qr_string) qrString = result.qr_string;
        else if (result.payment?.payment_number) qrString = result.payment.payment_number;

        if (!qrString) {
            return res.status(500).json({ error: "Gagal membuat QRIS. Cek Config API." });
        }

        // --- 3. SIMPAN ORDER KE DATABASE ---
        // Kita simpan semua payload (termasuk web_uid, type renew, dll)
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            ...payload, // Spread operator: Menyimpan semua data dari frontend
            status: 'PENDING',
            qris_content: qrString,
            createdAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            order_id: orderId,
            qris_content: qrString
        });

    } catch (error) {
        return res.status(500).json({ error: 'System Error: ' + error.message });
    }
}
