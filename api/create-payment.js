import { db } from './utils/firebase.js';
// Import fungsi cek ketersediaan yang baru kita buat
import { checkPteroAvailability } from './utils/ptero.js'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    // 1. Validasi Input Dasar
    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    // 2. [BARU] CEK KE PTERODACTYL DULU SEBELUM BIKIN QRIS
    // Agar user tidaklanjur bayar kalau username sudah kepakai
    const pteroError = await checkPteroAvailability(username, email);
    
    if (pteroError) {
        // Jika ada error (misal: "Username sudah dipakai"), kirim balik ke frontend
        // Frontend akan menampilkan ini di Toast merah
        return res.status(400).json({ error: pteroError });
    }

    try {
        // 3. Buat Order ID Unik
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;
        
        // 4. Request ke Pakasir (Contoh Logic - Sesuaikan dengan kode Pakasir Anda)
        // Pastikan endpoint dan body sesuai dengan dokumentasi Pakasir Anda
        const params = new URLSearchParams();
        params.append('api_key', process.env.PAKASIR_API_KEY); // Pastikan Env Variable benar
        params.append('project_id', process.env.PAKASIR_PROJECT_ID);
        params.append('amount', price);
        params.append('order_id', orderId);
        params.append('description', `Beli ${product}`);
        params.append('payment_method', 'qris');
        params.append('customer_name', username);
        params.append('customer_email', email);
        params.append('customer_phone', whatsapp);

        // Fetch ke Pakasir
        const pakasirReq = await fetch('https://pakasir.com/api/create-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const pakasirRes = await pakasirReq.json();

        // Cek Respon Pakasir
        if (!pakasirRes.success && !pakasirRes.data?.qr_string) {
            console.error("Pakasir Error:", pakasirRes);
            return res.status(500).json({ error: 'Gagal membuat QRIS. Coba lagi.' });
        }

        const qrString = pakasirRes.data ? pakasirRes.data.qr_string : pakasirRes.qr_string;

        // 5. Simpan Order ke Firebase (Pending)
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            username, email, password, whatsapp,
            product, price, category,
            ram, cpu, disk,
            status: 'PENDING',
            qris_content: qrString,
            createdAt: new Date().toISOString()
        });

        // 6. Kirim Balik ke Frontend
        return res.status(200).json({
            success: true,
            order_id: orderId,
            qris_content: qrString
        });

    } catch (error) {
        console.error("Create Payment Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
