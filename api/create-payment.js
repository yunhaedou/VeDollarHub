import { db } from './utils/firebase.js';
import axios from 'axios'; // Gunakan Axios biar stabil
import { checkPteroAvailability } from './utils/ptero.js'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    // 1. Validasi Input
    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    // 2. CEK USERNAME DI PTERODACTYL (Agar tidak error saat webhook)
    const pteroError = await checkPteroAvailability(username, email);
    if (pteroError) {
        return res.status(400).json({ error: pteroError });
    }

    try {
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;
        
        // 3. Request QRIS ke Pakasir (Pakai Axios)
        // Kita pakai URLSearchParams agar formatnya x-www-form-urlencoded (sesuai Pakasir)
        const params = new URLSearchParams();
        params.append('api_key', process.env.PAKASIR_API_KEY);
        params.append('project_id', process.env.PAKASIR_PROJECT_ID);
        params.append('amount', price);
        params.append('order_id', orderId);
        params.append('description', `Beli ${product}`);
        params.append('payment_method', 'qris');
        params.append('customer_name', username);
        params.append('customer_email', email);
        params.append('customer_phone', whatsapp);

        const pakasirReq = await axios.post('https://pakasir.com/api/create-transaction', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const pakasirRes = pakasirReq.data;

        // Cek Respon
        if ((!pakasirRes.success) && (!pakasirRes.data?.qr_string && !pakasirRes.qr_string)) {
            console.error("Pakasir Failed:", JSON.stringify(pakasirRes));
            return res.status(500).json({ error: 'Gagal membuat QRIS. Cek Config.' });
        }

        const qrString = pakasirRes.data ? pakasirRes.data.qr_string : pakasirRes.qr_string;

        // 4. Simpan ke Firebase
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            username, email, password, whatsapp,
            product, price, category,
            ram, cpu, disk,
            status: 'PENDING',
            qris_content: qrString,
            createdAt: new Date().toISOString()
        });

        // 5. Sukses
        return res.status(200).json({
            success: true,
            order_id: orderId,
            qris_content: qrString
        });

    } catch (error) {
        console.error("Payment Error:", error.message);
        return res.status(500).json({ error: 'Terjadi kesalahan sistem' });
    }
}
