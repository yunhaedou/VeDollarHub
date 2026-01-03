import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, productId } = req.body;

    if (!username || !email || !whatsapp) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    try {
        // --- CEK STOK KHUSUS APP PREMIUM ---
        if (category === 'app' && productId) {
            const prodRef = db.collection('products').doc(productId);
            const prodSnap = await prodRef.get();
            
            if (!prodSnap.exists) return res.status(404).json({ error: "Produk tidak ditemukan" });
            
            const prodData = prodSnap.data();
            if (!prodData.stock || prodData.stock.length === 0) {
                return res.status(400).json({ error: "Maaf, Stok Habis! Silakan hubungi admin." });
            }
        }

        // --- BUAT ORDER ID & QRIS ---
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        const payload = {
            api_key: process.env.PAKASIR_API_KEY,
            project: process.env.PAKASIR_PROJECT_ID,
            amount: parseInt(price),
            order_id: orderId,
            description: `Beli ${product}`,
            payment_method: "qris",
            customer_name: username,
            customer_email: email,
            customer_phone: whatsapp
        };

        const pakasirReq = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const pakasirRes = await pakasirReq.json();

        // Ambil QR String (Support berbagai format respon Pakasir)
        let qrString = null;
        if (pakasirRes.payment && pakasirRes.payment.payment_number) qrString = pakasirRes.payment.payment_number;
        else if (pakasirRes.data?.qr_string) qrString = pakasirRes.data.qr_string;
        else if (pakasirRes.qr_string) qrString = pakasirRes.qr_string;

        if (!qrString) {
            return res.status(500).json({ error: "Gagal membuat QRIS. Cek Config." });
        }

        // Simpan Order
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            username, email, password, whatsapp,
            product, price, category,
            productId: productId || "", // Simpan Product ID buat ambil stok nanti
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
