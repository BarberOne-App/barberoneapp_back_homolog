import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoute.js";
import productsRouter from "./routes/productsRouter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import serviceRouter from "./routes/serviceRouter.js";
import settingsRouter from "./routes/settingRouter.js";
import userRouter from "./routes/userRouter.js";
import barberRouter from "./routes/barberRouter.js";
import appointmentRouter from "./routes/appointmentRouter.js";
import blockedDateRouter from "./routes/blockedDateRouter.js";
import subscriptionPlanRouter from "./routes/subscriptionPlanRouter.js";
import subscriptionRouter from "./routes/subscriptionRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import paymentMethodRouter from "./routes/paymentMethodRouter.js";
import galleryRouter from "./routes/galleryRouter.js";
// import mercadoPagoRouter from "./routes/mercadoPagoRouter.js";
import webhookRouter from "./routes/webhookRouter.js";
import open from "open";
import path from "path";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Payment } from "mercadopago";


dotenv.config();

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.send({ ok: true }));


const mercadoPagoPublicKey = process.env.MERCADO_PAGO_PUBLIC_KEY;
if (!mercadoPagoPublicKey) {
    console.log("Error: public key not defined");
    process.exit(1);
}

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
if (!mercadoPagoAccessToken) {
    console.log("Error: access token not defined");
    process.exit(1);
}

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set("view engine", "html");
app.engine("html", hbs.__express);
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("./static"));
app.use(express.json());

app.get("/", function (req, res) {
    res.status(200).render("app", { mercadoPagoPublicKey });
});

app.post("/process_payment", async (req, res) => {
    try {
        const body = req.body;

        const payment = new Payment(client);
        console.log("Received payment request:", body);
        console.log("Using MercadoPago public key: " + process.env.MERCADO_PAGO_PUBLIC_KEY);
        console.log('Using MercadoPago access token:' + process.env.MERCADO_PAGO_ACCESS_TOKEN);

        const paymentData = {
            transaction_amount: Number(body.transaction_amount),
            token: body.token,
            description: body.description,
            installments: Number(body.installments),
            payment_method_id: body.payment_method_id,
            issuer_id: body.issuer_id,
            payer: {
                email: body.payer?.email,
                identification: {
                    type: body.payer?.identification?.type,
                    number: body.payer?.identification?.number,
                },
            },
        };

        const idempotencyKey = req.get("X-Idempotency-Key") || undefined;

        const result = await payment.create({
            body: paymentData,
            requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
        });

        // 🔥 devolve pro front o que ele precisa
        return res.status(201).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
            payment_method_id: result.payment_method_id,
            card: { last_four_digits: result.card?.last_four_digits },
        });
    } catch (error) {
        console.log(error);
        const { errorMessage, errorStatus } = validateError(error);
        return res.status(errorStatus).json({ error_message: errorMessage });
    }
});


// app.post("/process_payment", (req, res) => {
//     const { body } = req;
//     const { payer } = body;

//     const payment = new Payment(client);

//     const paymentData = {
//         transaction_amount: Number(body.transactionAmount),
//         token: body.token,
//         description: body.description,
//         installments: Number(body.installments),
//         payment_method_id: body.paymentMethodId,
//         issuer_id: body.issuerId,
//         payer: {
//             email: payer.email,
//             identification: {
//                 type: payer.identification.docType,
//                 number: payer.identification.docNumber,
//             },
//         },
//     };

//     payment
//         .create({ body: paymentData })
//         .then(function (data) {
//             res.status(201).json({
//                 detail: data.status_detail,
//                 status: data.status,
//                 id: data.id,
//             });
//         })
//         .catch(function (error) {
//             console.log(error);
//             const { errorMessage, errorStatus } = validateError(error);
//             res.status(errorStatus).json({ error_message: errorMessage });
//         });
// });

function validateError(error: any) {
    let errorMessage = "Unknown error cause";
    let errorStatus = 400;

    if (error.cause) {
        const sdkErrorMessage = error.cause[0].description;
        errorMessage = sdkErrorMessage || errorMessage;

        const sdkErrorStatus = error.status;
        errorStatus = sdkErrorStatus || errorStatus;
    }

    return { errorMessage, errorStatus };
}


app.use(authRoutes);
app.use(userRouter);
app.use(barberRouter);
app.use(appointmentRouter);
app.use(blockedDateRouter);
app.use(subscriptionPlanRouter);
app.use(subscriptionRouter);
app.use(paymentRouter);
app.use(paymentMethodRouter);
app.use(galleryRouter);
// app.use(mercadoPagoRouter);
app.use(webhookRouter);
app.use(productsRouter);
app.use(serviceRouter);
app.use(settingsRouter);
app.use(errorHandler);


const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API rodando na porta ${port}`));