import crypto from 'crypto';

const GRIEZ_API_ID = process.env.GRIEZ_API_ID;
const GRIEZ_API_KEY = process.env.GRIEZ_API_KEY;
const GRIEZ_ORDER_URL = "https://griezstore.id/api/order"; 

export async function orderGriez(serviceId, fullTarget) {
    if (!GRIEZ_API_ID || !GRIEZ_API_KEY) throw new Error("Griez API Config Missing");

    try {
        const sign = crypto.createHash('md5').update(GRIEZ_API_ID + GRIEZ_API_KEY).digest('hex');

        // Logika Pecah ID dan Zone
        // Input dari web biasanya "123456 (2020)"
        let targetId = fullTarget;
        let targetServer = "";

        if (fullTarget.includes("(") && fullTarget.includes(")")) {
            const split = fullTarget.split("(");
            targetId = split[0].trim();
            targetServer = split[1].replace(")", "").trim();
        }

        // Payload Sesuai Screenshot Order
        const payload = new URLSearchParams();
        payload.append('api_id', GRIEZ_API_ID);
        payload.append('api_key', GRIEZ_API_KEY);
        payload.append('signature', sign);
        payload.append('service_id', parseInt(serviceId)); // Harus Integer
        payload.append('target_id', targetId);
        
        if (targetServer) {
            payload.append('target_server', targetServer);
        }

        const req = await fetch(GRIEZ_ORDER_URL, { method: 'POST', body: payload });
        const res = await req.json();

        // Cek status true/false
        if (!res.status) {
            throw new Error(res.msg || "Gagal Order Griez");
        }

        return res.data; 

    } catch (error) {
        console.error("Griez Order Error:", error.message);
        throw error;
    }
}
