// import axios from 'axios';

// const API_BASE_URL = 'https://telstra-hackathon-apis.p-eu.rapidapi.com/passthrough/camara/v1';
// const API_KEY = '15cc20cd08msh7054d8a2a3ed868p146283jsn43ebc1478fe7';

// const defaultHeaders = {
//     'Content-Type': 'application/json',
//     'authorization': 'Test',
//     'x-rapidapi-host': 'telstra-hackathon-apis.nokia.rapidapi.com',
//     'x-rapidapi-key': API_KEY
// };

// async function post(url, body) {
//     const response = await axios.post(url, body, { headers: defaultHeaders });
//     return response.data;
// }

// import axios from 'axios';

// const API_BASE_URL = 'https://telstra-hackathon-apis.p-eu.rapidapi.com/passthrough/camara/v1';
// const API_KEY = '15cc20cd08msh7054d8a2a3ed868p146283jsn43ebc1478fe7';

// const defaultHeaders = {
//     'Content-Type': 'application/json',
//     'authorization': 'Test',
//     'x-rapidapi-host': 'telstra-hackathon-apis.nokia.rapidapi.com',
//     'x-rapidapi-key': API_KEY
// };

// async function post(url, body) {
//     const response = await axios.post(url, body, { headers: defaultHeaders });
//     return response.data;
// }

export function verifyPhoneNumber(phoneNumber, logApiInteraction) {
    // return post(`${API_BASE_URL}/number-verification/number-verification/v0/verify`, { phoneNumber });
    const requestPayload = { phoneNumber };
    return new Promise(resolve => {
        setTimeout(() => {
            const response = {
                devicePhoneNumberVerified: true
            };
            if (logApiInteraction) {
                logApiInteraction('Verify Phone Number', 'POST', '/number-verification/verify', requestPayload, response);
            }
            resolve(response);
        }, 500);
    });
}

export function kycMatch(data, logApiInteraction) {
    //return post(`${API_BASE_URL}/kyc-match/kyc-match/v0.2/match`, data);
    const response = {
        nameMatch: 'true',
        addressMatch: 'true',
        emailMatch: 'true',
        birthdateMatch: 'true'
    };
    if (logApiInteraction) {
        logApiInteraction('KYC Match', 'POST', '/kyc-match/match', data, response);
    }
    return Promise.resolve(response);
}

export function simSwap(phoneNumber, logApiInteraction) {
    //return post(`${API_BASE_URL}/sim-swap/sim-swap/v0/check`, { phoneNumber, maxAge: 240 });
    const requestPayload = { phoneNumber, maxAge: 240 };
    const response = { swapped: false };
    if (logApiInteraction) logApiInteraction('SIM Swap', 'POST', '/sim-swap/check', requestPayload, response);
    return Promise.resolve(response);
}

export function deviceSwap(phoneNumber, logApiInteraction) {
    //return post(`${API_BASE_URL}/device-swap/device-swap/v0.1/check`, { phoneNumber, maxAge: 240 });
    const requestPayload = { phoneNumber, maxAge: 240 };
    const response = { swapped: false };
    if (logApiInteraction) logApiInteraction('Device Swap', 'POST', '/device-swap/check', requestPayload, response);
    return Promise.resolve(response);
}


const mockKycData = {
    '61400500800': { name: 'Michael Jackson', address: '242 Exhibition St, Melbourne', birthdate: '1958-08-29', email: 'michael.hehe@gmail.com' },
    '61400500801': { name: 'Maria Fernanda González', address: '12 Collins St, Melbourne VIC 3000', birthdate: '1968-02-08', email: 'gonzalez02081968@example.com' },
    '61400500802': { name: 'John Smith', address: '85 George St, Sydney NSW 2000', birthdate: '1979-12-20', email: 'john20121979@outlook.com' },
    '61400500803': { name: 'Aisha Mohammed Al-Farsi', address: '7 Adelaide Terrace, Perth WA 6000', birthdate: '1950-03-13', email: 'aishaal-farsi13031950@example.com' },
    '61400500804': { name: 'Chen Wei', address: '23 North Terrace, Adelaide SA 5000', birthdate: '1979-03-22', email: 'chen22031979@example.com' },
    '61400500805': { name: 'Priya Ramesh Kumar', address: '45 Margaret St, Brisbane QLD 4000', birthdate: '1974-04-12', email: 'priyak12041974@gmail.com' },
    '61400500806': { name: 'Jean-Pierre Dubois', address: '18 Macquarie St, Hobart TAS 7000', birthdate: '1957-05-30', email: 'user3674@yahoo.com' },
    '61400500807': { name: 'Anna Ivanova', address: '9 London Circuit, Canberra ACT 2601', birthdate: '2000-08-22', email: 'anna.22@outlook.com' },
    '61400500808': { name: 'David Oluwaseun Adeyemi', address: '56 Cavenagh St, Darwin NT 0800', birthdate: '1974-01-24', email: 'david.adeyemi24@gmail.com' },
    '61400500809': { name: 'Sofia Rossi', address: '101 Swanston St, Melbourne VIC 3000', birthdate: '1981-12-29', email: '.sofia@yahoo.com' },
    '61400500810': { name: 'Ahmed Hassan', address: '220 Pitt St, Sydney NSW 2000', birthdate: '2002-09-01', email: 'ahmed.hassan.@yahoo.com' },
    '61400500811': { name: 'Yuki Tanaka', address: '33 St Georges Terrace, Perth WA 6000', birthdate: '1967-12-23', email: 'yuki.23@outlook.com' },
    '61400500812': { name: 'Isabella Maria Costa', address: '14 King William St, Adelaide SA 5000', birthdate: '1996-06-16', email: 'isabella.maria.costa@gmail.com' },
    '61400500813': { name: 'Thabo Mokoena', address: '67 Queen St, Brisbane QLD 4000', birthdate: '1998-07-02', email: 'thabo.mokoena.@yahoo.com' },
    '61400500814': { name: 'Emily Grace Johnson', address: '5 Elizabeth St, Hobart TAS 7000', birthdate: '1957-09-05', email: 'emily.johnson09@gmail.com' },
    '61400500815': { name: 'Fatima Zahra El Amrani', address: '2 Akuna St, Canberra ACT 2601', birthdate: '1997-06-29', email: 'fatima.zahra.elamrani@example.com' },
    '61400500816': { name: 'Lars Eriksson', address: '88 Mitchell St, Darwin NT 0800', birthdate: '2002-12-16', email: 'lars@outlook.com' },
    '61400500817': { name: 'Olga Petrovna Sokolova', address: '77 Bourke St, Melbourne VIC 3000', birthdate: '1958-06-14', email: 'user4635@yahoo.com' },
    '61400500818': { name: 'Lucas Martín Pérez', address: '150 Castlereagh St, Sydney NSW 2000', birthdate: '1983-09-02', email: 'perez02091983@example.com' },
    '61400500819': { name: 'Siti Nurhaliza', address: '21 Hay St, Perth WA 6000', birthdate: '1968-09-16', email: 'user5786@yahoo.com' },
    '61400500820': { name: 'Michael James O\'Connor', address: '39 Grote St, Adelaide SA 5000', birthdate: '1976-05-17', email: 'michael.james.oconnor@gmail.com' },
    '61400500821': { name: 'Alejandro Javier Morales', address: '12 Ann St, Brisbane QLD 4000', birthdate: '1985-08-12', email: 'alejandrom12081985@yahoo.com' },
    '61400500822': { name: 'Grace Nia Williams', address: '30 Davey St, Hobart TAS 7000', birthdate: '1992-05-30', email: 'williamsgrace@yahoo.com' },
    '61400500823': { name: 'Kwame Kofi Mensah', address: '11 Marcus Clarke St, Canberra ACT 2601', birthdate: '1972-01-19', email: 'kwamem19011972@gmail.com' },
    '61400500824': { name: 'Mei Ling Zhang', address: '60 Smith St, Darwin NT 0800', birthdate: '1999-01-02', email: 'mei.zhang02@yahoo.com' },
    '61400500825': { name: 'Samuel Oluwafemi Okoro', address: '200 Lonsdale St, Melbourne VIC 3000', birthdate: '1971-03-30', email: 'okorosamuel@gmail.com' },
    '61400500826': { name: 'Anna Maria Schmidt', address: '300 George St, Sydney NSW 2000', birthdate: '1984-12-24', email: 'annaschmidt24121984@gmail.com' },
    '61400500827': { name: 'Hassan Ali Rahman', address: '8 William St, Perth WA 6000', birthdate: '2003-09-30', email: 'hassan30092003@example.com' },
    '61400500828': { name: 'Sofia Elena Petrova', address: '25 Pulteney St, Adelaide SA 5000', birthdate: '1962-11-04', email: 'sofia.petrova@example.com' },
    '61400500829': { name: 'Lucas Daniel Ferreira', address: '55 Turbot St, Brisbane QLD 4000', birthdate: '1985-01-14', email: 'lucas.ferreira@yahoo.com' },
    '61400500830': { name: 'Amira Noor Al-Mansouri', address: '22 Murray St, Hobart TAS 7000', birthdate: '1964-12-24', email: 'al-mansouri24121964@yahoo.com' },
    '61400500831': { name: 'Ethan James O\'Leary', address: '4 London Cct, Canberra ACT 2601', birthdate: '1989-05-22', email: 'ethano22051989@example.com' },
    '61400500832': { name: 'Isabella Sofia Romano', address: '15 Daly St, Darwin NT 0800', birthdate: '1968-02-05', email: 'isabellar05021968@example.com' },
    '61400500833': { name: 'Rajesh Kumar Singh', address: '19 Flinders St, Melbourne VIC 3000', birthdate: '1958-09-27', email: 'rajesh27091958@example.com' },
    '61400500834': { name: 'Chloe Mae Evans', address: '400 Kent St, Sydney NSW 2000', birthdate: '1953-12-29', email: 'evanschloe@yahoo.com' },
    '61400500835': { name: 'Leila Fatemeh Hosseini', address: '12 Barrack St, Perth WA 6000', birthdate: '1956-04-19', email: 'leila.hosseini@outlook.com' },
    '61400500836': { name: 'Daniel George Papadopoulos', address: '17 Wakefield St, Adelaide SA 5000', birthdate: '1953-11-29', email: 'daniel.george.papadopoulos@yahoo.com' },
    '61400500837': { name: 'Amina Binta Diallo', address: '80 Roma St, Brisbane QLD 4000', birthdate: '1971-02-15', email: 'aminadiallo15021971@example.com' },
    '61400500838': { name: 'Tomasz Marek Nowak', address: '9 Bathurst St, Hobart TAS 7000', birthdate: '1984-08-31', email: 'nowak.tomasz@example.com' },
    '61400500839': { name: 'Siti Aisyah Binti Ahmad', address: '7 Allara St, Canberra ACT 2601', birthdate: '1956-10-21', email: 'sitibinti.ahmad21101956@outlook.com' },
    '61400500840': { name: 'Jacob Müller', address: '25 Bennett St, Darwin NT 0800', birthdate: '1986-12-02', email: 'jacob@example.com' },
    '61400500841': { name: 'Maria Luisa Hernández', address: '250 Spencer St, Melbourne VIC 3000', birthdate: '1978-12-05', email: 'maria.hernandez@yahoo.com' },
    '61400500842': { name: 'Benjamin Lee Chen', address: '500 Elizabeth St, Sydney NSW 2000', birthdate: '1964-08-26', email: 'chen26081964@example.com' },
    '61400500843': { name: 'Sara Fatima Rahimi', address: '6 Murray St, Perth WA 6000', birthdate: '1979-10-12', email: 'rahimi12101979@outlook.com' },
    '61400500844': { name: 'Peter Andreas Müller', address: '13 Franklin St, Adelaide SA 5000', birthdate: '1961-05-02', email: 'peter.muller@example.com' },
    '61400500845': { name: 'Lucia Beatriz Silva', address: '90 Albert St, Brisbane QLD 4000', birthdate: '1987-01-29', email: 'user3411@example.com' },
    '61400500846': { name: 'Omar Khaled Al-Sayed', address: '16 Liverpool St, Hobart TAS 7000', birthdate: '1975-04-13', email: 'al-sayedomar@outlook.com' },
    '61400500847': { name: 'Julia Annabelle Fischer', address: '3 Constitution Ave, Canberra ACT 2601', birthdate: '1993-10-30', email: 'julia.fischer@example.com' },
    '61400500848': { name: 'Nia Thandeka Dlamini', address: '40 Cavenagh St, Darwin NT 0800', birthdate: '1972-12-07', email: 'niadlamini07121972@example.com' },
    '61400500849': { name: 'Andrej Nikolaevich Ivanov', address: '60 Exhibition St, Melbourne VIC 3000', birthdate: '1964-11-08', email: 'ivanov08111964@yahoo.com' },
    '61400500850': { name: 'Gabriela Sofia Torres', address: '600 Sussex St, Sydney NSW 2000', birthdate: '1987-05-25', email: 'user8021@outlook.com' },
    '61400500851': { name: 'Hassan Youssef El-Sayed', address: '10 Wellington St, Perth WA 6000', birthdate: '1993-07-11', email: 'el-sayedhassan@gmail.com' },
    '61400500852': { name: 'Emily Rose Parker', address: '21 Currie St, Adelaide SA 5000', birthdate: '1986-01-17', email: 'emilyparker17011986@example.com' },
    '61400500853': { name: 'Daniel Alejandro Vargas', address: '100 Edward St, Brisbane QLD 4000', birthdate: '1969-11-25', email: 'danielv25111969@example.com' },
    '61400500854': { name: 'Aisha Fatoumata Traoré', address: '8 Collins St, Hobart TAS 7000', birthdate: '1986-09-12', email: 'traore.aisha@outlook.com' },
    '61400500855': { name: 'Samuel David Kim', address: '5 National Circuit, Canberra ACT 2600', birthdate: '1999-06-19', email: 'samuel.kim19@yahoo.com' },
    '61400500856': { name: 'Isabella Grace Moretti', address: '12 Woods St, Darwin NT 0800', birthdate: '1954-09-08', email: 'isabellam08091954@gmail.com' },
    '61400500857': { name: 'Ahmed Samir Mahmoud', address: '15 La Trobe St, Melbourne VIC 3000', birthdate: '1969-05-22', email: 'mahmoud22051969@gmail.com' },
    '61400500858': { name: 'Anna Viktoria Johansson', address: '700 George St, Sydney NSW 2000', birthdate: '1981-08-05', email: 'johansson05081981@gmail.com' },
    '61400500859': { name: 'Juan Carlos Ramirez', address: '14 Milligan St, Perth WA 6000', birthdate: '1953-02-06', email: 'juan.ramirez@yahoo.com' },
    '61400500860': { name: 'Leila Yasmin Farouk', address: '27 King William St, Adelaide SA 5000', birthdate: '1976-01-22', email: 'leilaf22011976@example.com' },
    '61400500861': { name: 'Michael Andrew Brown', address: '120 Charlotte St, Brisbane QLD 4000', birthdate: '1988-05-03', email: 'michael.andrew.brown@example.com' },
    '61400500862': { name: 'Priya Suresh Patel', address: '20 Argyle St, Hobart TAS 7000', birthdate: '1962-09-22', email: 'patel.priya@outlook.com' },
    '61400500863': { name: 'Sofia Maria Dimitriou', address: '6 London Circuit, Canberra ACT 2601', birthdate: '1954-11-24', email: 'sofia.maria.dimitriou@outlook.com' },
    '61400500864': { name: 'David Emmanuel Mensah', address: '18 Knuckey St, Darwin NT 0800', birthdate: '1974-04-01', email: 'user1937@gmail.com' },
    '61400500865': { name: 'Yuki Haruto Nakamura', address: '80 Bourke St, Melbourne VIC 3000', birthdate: '1986-10-20', email: 'user4443@outlook.com' },
    '61400500866': { name: 'Fatima Noor Siddiqui', address: '800 Pitt St, Sydney NSW 2000', birthdate: '1975-05-17', email: 'fatima17051975@example.com' },
    '61400500867': { name: 'Lucas Gabriel Oliveira', address: '16 St Georges Terrace, Perth WA 6000', birthdate: '1995-10-24', email: 'user4224@example.com' },
    '61400500868': { name: 'Chloe Isabelle Martin', address: '31 Grenfell St, Adelaide SA 5000', birthdate: '1959-01-05', email: 'chloe05011959@outlook.com' },
    '61400500869': { name: 'Rajiv Prakash Mehra', address: '130 Mary St, Brisbane QLD 4000', birthdate: '1967-10-03', email: 'mehra03101967@example.com' },
    '61400500870': { name: 'Maria Teresa Santos', address: '24 Macquarie St, Hobart TAS 7000', birthdate: '1999-11-29', email: 'maria29111999@outlook.com' },
    '61400500871': { name: 'Ethan William Harris', address: '8 Marcus Clarke St, Canberra ACT 2601', birthdate: '1985-06-07', email: 'ethanharris07061985@example.com' },
    '61400500872': { name: 'Amira Layla Hassan', address: '22 Mitchell St, Darwin NT 0800', birthdate: '1953-03-13', email: 'amira.hassan13@outlook.com' },
    '61400500873': { name: 'Tomasz Piotr Zielinski', address: '90 Collins St, Melbourne VIC 3000', birthdate: '1973-04-11', email: 'tomasz.zielinski@outlook.com' },
    '61400500874': { name: 'Anna Katarzyna Nowak', address: '900 George St, Sydney NSW 2000', birthdate: '1970-09-22', email: 'nowak22091970@yahoo.com' },
    '61400500875': { name: 'Samuel Kwabena Boateng', address: '18 Pier St, Perth WA 6000', birthdate: '1999-05-28', email: 'samuel28051999@outlook.com' },
    '61400500876': { name: 'Isabella Lucia Romano', address: '35 King William St, Adelaide SA 5000', birthdate: '1973-08-24', email: 'user2067@gmail.com' },
    '61400500877': { name: 'Ahmed Tariq Al-Mansoori', address: '140 Creek St, Brisbane QLD 4000', birthdate: '1970-07-31', email: 'user9458@outlook.com' },
    '61400500878': { name: 'Emily Charlotte Davies', address: '28 Elizabeth St, Hobart TAS 7000', birthdate: '1963-07-07', email: 'daviesemily@yahoo.com' },
    '61400500879': { name: 'Daniel Sebastian Weber', address: '10 Allara St, Canberra ACT 2601', birthdate: '1985-11-25', email: 'user4052@outlook.com' },
    '61400500880': { name: 'Sofia Elena Popescu', address: '30 Cavenagh St, Darwin NT 0800', birthdate: '2004-03-11', email: 'sofia.popescu11@gmail.com' },
    '61400500881': { name: 'Hassan Omar Abdallah', address: '100 Flinders St, Melbourne VIC 3000', birthdate: '1956-10-05', email: 'hassan.abdallah@example.com' },
    '61400500882': { name: 'Priya Anjali Sharma', address: '1000 Pitt St, Sydney NSW 2000', birthdate: '1989-03-27', email: 'priya27031989@yahoo.com' },
    '61400500883': { name: 'Lucas Rafael Costa', address: '20 Hay St, Perth WA 6000', birthdate: '1984-07-20', email: 'lucas20071984@gmail.com' },
    '61400500884': { name: 'Chloe Amelia Thompson', address: '41 Currie St, Adelaide SA 5000', birthdate: '1972-04-13', email: 'chloethompson13041972@example.com' },
    '61400500885': { name: 'Rajesh Anand Kumar', address: '150 Ann St, Brisbane QLD 4000', birthdate: '1963-12-04', email: 'kumar04121963@example.com' },
    '61400500886': { name: 'Maria Clara Souza', address: '32 Murray St, Hobart TAS 7000', birthdate: '1985-05-22', email: 'souzamaria@gmail.com' },
    '61400500887': { name: 'Ethan Joseph Murphy', address: '12 National Circuit, Canberra ACT 2600', birthdate: '1991-07-29', email: 'murphyethan@gmail.com' },
    '61400500888': { name: 'Leila Yasmin Rahman', address: '35 Woods St, Darwin NT 0800', birthdate: '1970-03-04', email: 'rahman04031970@outlook.com' },
    '61400500889': { name: 'Tomasz Andrzej Kowalski', address: '110 Bourke St, Melbourne VIC 3000', birthdate: '1952-01-16', email: 'tomaszkowalski16011952@yahoo.com' },
    '61400500890': { name: 'Anna Maria Petrova', address: '1100 George St, Sydney NSW 2000', birthdate: '1966-04-21', email: 'anna.petrova@example.com' },
    '61400500891': { name: 'Samuel Oluwaseyi Adeyemi', address: '22 Wellington St, Perth WA 6000', birthdate: '1955-03-16', email: 'samuel.oluwaseyi.adeyemi@yahoo.com' },
    '61400500892': { name: 'Isabella Sofia Costa', address: '43 Franklin St, Adelaide SA 5000', birthdate: '1962-11-22', email: 'isabella.costa22@outlook.com' },
    '61400500893': { name: 'Ahmed Karim El-Sayed', address: '160 Edward St, Brisbane QLD 4000', birthdate: '1957-04-30', email: 'ahmed.el-sayed30@outlook.com' },
    '61400500894': { name: 'Emily Grace Robinson', address: '36 Collins St, Hobart TAS 7000', birthdate: '1976-04-12', email: 'emilyrobinson12041976@example.com' },
    '61400500895': { name: 'Daniel George Papadopoulos', address: '14 Constitution Ave, Canberra ACT 2600', birthdate: '1955-07-19', email: 'papadopoulos19071955@gmail.com' },
    '61400500896': { name: 'Sofia Maria Rossi', address: '50 Knuckey St, Darwin NT 0800', birthdate: '1957-08-16', email: 'rossi.sofia@yahoo.com' },
    '61400500897': { name: 'Hassan Ali Rahman', address: '120 Exhibition St, Melbourne VIC 3000', birthdate: '1989-01-06', email: 'rahman.hassan@yahoo.com' },
    '61400500898': { name: 'Priya Ramesh Kumar', address: '1200 Pitt St, Sydney NSW 2000', birthdate: '1962-07-03', email: 'priyak03071962@outlook.com' },
    '61400500899': { name: 'Lucas Daniel Ferreira', address: '24 Barrack St, Perth WA 6000', birthdate: '1979-11-01', email: 'lucas01111979@outlook.com' },
    '61400500900': { name: 'Chloe Mae Evans', address: '45 Pulteney St, Adelaide SA 5000', birthdate: '1980-01-20', email: 'chloe.evans20@outlook.com' },
};

const defaultKycData = {
    name: 'Michael Jackson',
    address: '242 Exhibition St, Melbourne',
    email: 'michael.hehe@gmail.com',
    birthdate: '1958-08-29'
};

export function kycFill(phoneNumber, logApiInteraction) {
    const requestPayload = { phoneNumber };
    return new Promise(resolve => {
        setTimeout(() => {
            const phone = phoneNumber ? phoneNumber.replace('+', '') : '';
            let userData = mockKycData[phone]; // Attempt to find user data

            if (!userData) {
                // Fallback to default data if no match
                userData = defaultKycData;
            }
            if (logApiInteraction) {
                logApiInteraction('KYC Fill', 'GET', '/kyc-fill/fill', requestPayload, userData);
            }
            resolve(userData);
        }, 1000); // Simulate network delay
    });
}

export function locationRetrieval(phoneNumber, logApiInteraction, mockCoordinates) {
    const requestPayload = { device: { phoneNumber } };
    return new Promise(resolve => {
        setTimeout(() => {
            let center;
            if (mockCoordinates) {
                center = {
                    latitude: mockCoordinates.lat || mockCoordinates.latitude,
                    longitude: mockCoordinates.lng || mockCoordinates.longitude
                };
            } else {
                // Default Hotel Location (Melbourne)
                center = {
                    latitude: -37.8136,
                    longitude: 144.9631
                };
            }
            const response = {
                lastLocationTime: new Date().toISOString(),
                area: {
                    areaType: "CIRCLE",
                    center: center,
                    radius: 100
                }
            };
            if (logApiInteraction) {
                logApiInteraction('Location Retrieval', 'POST', '/location-retrieval/retrieve', requestPayload, response);
            }
            resolve(response);
        }, 500);
    });
}

export function locationVerification(data, logApiInteraction) {
    return new Promise(resolve => {
        setTimeout(() => {
            const response = {
                verificationResult: "TRUE"
            };
            if (logApiInteraction) {
                logApiInteraction('Location Verification', 'POST', '/location-verification/verify', data, response);
            }
            resolve(response);
        }, 500);
    });
}

export function carrierBilling(phoneNumber, logApiInteraction) {
    const requestPayload = { 
        amountTransaction: {
            phoneNumber: phoneNumber,
            paymentAmount: {
                chargingInformation: {
                    amount: 299.00,
                    currency: "AUD"
                }
            }
        }
    };
    return new Promise(resolve => {
        setTimeout(() => {
            const response = {
                paymentId: "tx-" + Math.floor(Math.random() * 100000),
                paymentStatus: "succeeded"
            };
            if (logApiInteraction) {
                logApiInteraction('Carrier Billing', 'POST', '/carrier-billing/payment/v1/charge', requestPayload, response);
            }
            resolve(response);
        }, 1000);
    });
}

// Global beacon event queue for waiting
let beaconEventQueue = [];
let beaconWaiters = [];

// Function to notify beacon detection
export function notifyBeaconDetection(zone) {
    console.log('[API] Beacon detected, notifying waiters:', zone);
    console.log('[API] Current waiters:', beaconWaiters.length);
    beaconEventQueue.push(zone);
    // Check all waiters
    beaconWaiters.forEach((waiter, index) => {
        const matched = waiter.keywords.some(keyword => zone.toLowerCase().includes(keyword.toLowerCase()));
        console.log(`[API] Checking waiter ${index}, keywords:`, waiter.keywords, 'matched:', matched);
        if (matched && !waiter.resolved) {
            waiter.resolved = true;
            console.log('[API] Resolving waiter with zone:', zone);
            waiter.resolve(zone);
        }
    });
}

// Helper function to wait for specific BLE beacon
function waitForBeacon(beaconKeywords, addMessage) {
    return new Promise((resolve) => {
        console.log('[API] Waiting for beacon with keywords:', beaconKeywords);
        addMessage(`Waiting for BLE beacon detection (${beaconKeywords.join(' or ')})...`);
        
        // Check if beacon already detected
        const existingBeacon = beaconEventQueue.find(zone => 
            beaconKeywords.some(keyword => zone.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        if (existingBeacon) {
            console.log('[API] Beacon already in queue:', existingBeacon);
            addMessage(`BLE Beacon already detected: ${existingBeacon}`);
            resolve(existingBeacon);
            return;
        }
        
        // Add to waiters
        const waiter = { keywords: beaconKeywords, resolve, resolved: false };
        beaconWaiters.push(waiter);
        console.log('[API] Added waiter, total waiters:', beaconWaiters.length);
    });
}

export async function startBookingAndArrivalSequence(phoneNumber, initialUserLocation, hotelLocation, addMessage, setLocation, setUserGps, setCheckInStatus, setRfidStatus, setPaymentStatus, setElevatorAccess, setRoomAccess, generateRoute, setArtificialTime, handleAccessSequence, logApiInteraction, addGuestMessage, guestName = 'Guest', gatewayClient, processBeaconDetection, setIsAutoScanning, bleUnsubscribeRef) {
    addMessage("Starting Booking and Arrival sequence...");
    addGuestMessage(`Your journey to Telstra Towers is beginning, ${guestName}...`, 'info');

    await new Promise(resolve => setTimeout(resolve, 5000));
    addMessage("Pre-populating booking information...");
    const bookingInfo = {
        checkIn: "2026-01-16T15:00:00",
        checkOut: "2026-01-17T11:00:00"
    };
    addMessage(`Check-in: ${bookingInfo.checkIn}, Check-out: ${bookingInfo.checkOut}`);

    await new Promise(resolve => setTimeout(resolve, 5000));
    const checkInDate = new Date();
    checkInDate.setHours(15, 0, 0, 0);
    const startTime = new Date(checkInDate.getTime() - 3 * 60 * 60 * 1000);
    setArtificialTime(startTime);
    addMessage(`Artificial clock set to ${startTime.toLocaleTimeString()}.`);

    await new Promise(resolve => setTimeout(resolve, 5000));

    const route = generateRoute(initialUserLocation, hotelLocation);
    const timeSteps = [
        { minutes: 0, delay: 2000 },
        { minutes: 30, delay: 2000 },
        { minutes: 60, delay: 2000 },
        { minutes: 90, delay: 2000 },
        { minutes: 120, delay: 2000 },
        { minutes: 150, delay: 2000 },
        { minutes: 180, delay: 2000 },
        { minutes: 185, delay: 1000 },
        { minutes: 190, delay: 1000 },
        { minutes: 195, delay: 1000 },
        { minutes: 200, delay: 1000 },
    ];

    for (let i = 0; i < timeSteps.length; i++) {
        const step = timeSteps[i];
        const currentLocation = route[i];
        const stepTime = new Date(startTime.getTime() + step.minutes * 60 * 1000);
        setArtificialTime(stepTime);
        addMessage(`Calling Location Retrieval at ${stepTime.toLocaleTimeString()}`);
        
        const locRes = await locationRetrieval(phoneNumber, logApiInteraction, currentLocation);
        setLocation(locRes);
        setUserGps(currentLocation);
        addMessage(`User is at lat: ${currentLocation.lat.toFixed(4)}, lng: ${currentLocation.lng.toFixed(4)}`);
        await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    addMessage("User has arrived within the vicinity.");
    addGuestMessage(`You are approaching Telstra Towers, ${guestName}. Check-in will be available soon!`, 'info');

    setUserGps(hotelLocation);
    addMessage("Location updated: Hotel Entrance");

    addMessage(`Starting ${guestName} Auto-Tracking`);
    setIsAutoScanning(true);

    // STEP 1: Wait for Entry Gate beacon
    addMessage("Waiting for guest to reach Entry Gate...");
    addGuestMessage(`Please proceed to the hotel entrance, ${guestName}.`, 'info');
    await waitForBeacon(['Gate', 'Hotel'], addMessage);
    addGuestMessage(`Welcome to Telstra Towers, ${guestName}! You have arrived at the hotel entrance.`, 'success');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // STEP 2: Wait for Kiosk beacon
    addMessage("Waiting for guest to reach Check-in Kiosk...");
    addGuestMessage('Please proceed to the check-in kiosk.', 'info');
    await waitForBeacon(['Kiosk', 'Lobby'], addMessage);
    
    addMessage("Guest at Check-in Kiosk. Processing check-in...");
    addGuestMessage('Processing your check-in...', 'processing');
    setCheckInStatus("Checked In");
    const checkInLocation = { lat: hotelLocation.lat + 0.0001, lng: hotelLocation.lng };
    setUserGps(checkInLocation);
    
    addMessage("Check-in process: RFID scan at kiosk...");
    setRfidStatus("Verified");
    await new Promise(resolve => setTimeout(resolve, 2000));
    addMessage("Check-in complete. RFID activated.");
    addGuestMessage(`Check-in complete, ${guestName}! Welcome to Room 1337. Enjoy your stay!`, 'success');
    await new Promise(resolve => setTimeout(resolve, 1000));
    addGuestMessage('Hotel amenities: Pool (Level 5), Gym (Level 4), Restaurant (Ground Floor)', 'info');

    // STEP 3: Wait for Elevator beacon
    addMessage("Waiting for guest to reach Elevator...");
    addGuestMessage('Please proceed to the elevator.', 'info');
    await waitForBeacon(['Elevator', 'Lift'], addMessage);
    
    addMessage("Guest at Elevator. Verifying identity...");
    addGuestMessage('Verifying your identity for elevator access...', 'processing');
    const elevatorLocation = { lat: hotelLocation.lat + 0.0001, lng: hotelLocation.lng + 0.0001 };
    setUserGps(elevatorLocation);
    
    const simSwapResult = await simSwap(phoneNumber, logApiInteraction);
    const deviceSwapResult = await deviceSwap(phoneNumber, logApiInteraction);
    if (simSwapResult.swapped === false && deviceSwapResult.swapped === false) {
        setElevatorAccess('Yes, Floor 13');
        addMessage("Access Granted: Elevator to Floor 13.");
        addGuestMessage('Elevator access granted! Proceeding to Floor 13.', 'success');
    } else {
        addGuestMessage('Elevator access denied. Please contact reception.', 'error');
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));

    // STEP 4: Wait for Room beacon
    addMessage("Waiting for guest to reach Room Door...");
    addGuestMessage('Please proceed to your room (Room 1337).', 'info');
    await waitForBeacon(['Room', 'Door'], addMessage);
    
    addMessage("Guest at Room Door. Verifying identity...");
    addGuestMessage('Verifying your identity for room access...', 'processing');
    const roomLocation = { lat: hotelLocation.lat + 0.0002, lng: hotelLocation.lng + 0.0002 };
    setUserGps(roomLocation);
    
    const simSwapResult2 = await simSwap(phoneNumber, logApiInteraction);
    const deviceSwapResult2 = await deviceSwap(phoneNumber, logApiInteraction);
    if (simSwapResult2.swapped === false && deviceSwapResult2.swapped === false) {
        setRoomAccess('Granted');
        addMessage("Access Granted: Room 1337 Unlocked.");
        addGuestMessage(`Welcome to your room, ${guestName}! Door unlocked. Enjoy your stay!`, 'success');
    } else {
        addGuestMessage('Room access denied. Please contact reception.', 'error');
    }
}

export async function startCheckOutSequence(phoneNumber, initialUserLocation, hotelLocation, addMessage, setLocation, setUserGps, setCheckInStatus, generateRoute, setArtificialTime, setPaymentStatus, setElevatorAccess, setRoomAccess, setRfidStatus, guestName, logApiInteraction, addGuestMessage) {
    addMessage("Starting Check-out sequence...");
    addGuestMessage(`Processing your check-out, ${guestName}. Please wait...`, 'processing');
    await new Promise(resolve => setTimeout(resolve, 5000));

    addMessage("Calling Carrier Billing API to finalise payment...");
    const billingRes = await carrierBilling(phoneNumber, logApiInteraction);
    if (billingRes.paymentStatus === 'succeeded') {
        addMessage("Carrier Billing Successful. Amount: 299.00 AUD");
        addGuestMessage('Payment successful! Amount charged: $299.00 AUD', 'success');
    } else {
        addMessage("Carrier Billing Failed.");
        addGuestMessage('Payment failed. Please contact reception.', 'error');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Use relative time - 15 minutes before checkout
    const checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    checkOutDate.setHours(11, 0, 0, 0);
    const checkoutTime = new Date(checkOutDate.getTime() - 15 * 60 * 1000);
    setArtificialTime(checkoutTime);
    addMessage(`Artificial clock set to ${checkoutTime.toLocaleTimeString()} for checkout.`);

    const route = generateRoute(hotelLocation, initialUserLocation); // Route from hotel to initial user location

    const timeSteps = [
        { minutes: 0, delay: 2000, routeIndex: 2 }, // Short distance
        { minutes: 15, delay: 2000, routeIndex: 5 }, // Further
        { minutes: 30, delay: 2000, routeIndex: 8 }, // Even further
        { minutes: 35, delay: 2000, routeIndex: 9 }, // Far away
    ];

    for (const step of timeSteps) {
        const currentLocation = route[step.routeIndex];
        const stepTime = new Date(checkoutTime.getTime() + step.minutes * 60 * 1000);
        setArtificialTime(stepTime);
        addMessage(`Calling Location Retrieval at ${stepTime.toLocaleTimeString()}`);
        
        const locRes = await locationRetrieval(phoneNumber, logApiInteraction, currentLocation);
        setLocation(locRes);
        setUserGps(currentLocation);
        addMessage(`User is at lat: ${currentLocation.lat.toFixed(4)}, lng: ${currentLocation.lng.toFixed(4)}`);
        await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    addMessage("User is now far away from the hotel.");
    await new Promise(resolve => setTimeout(resolve, 2000));

    addMessage(`Contact guest ${guestName} on ${phoneNumber} to confirm check out.`);
    setCheckInStatus("Checked Out");
    setRfidStatus("Unverified");
    setPaymentStatus("Paid");
    setElevatorAccess("No");
    setRoomAccess("No");
}
