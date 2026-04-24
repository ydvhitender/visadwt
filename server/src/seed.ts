import mongoose from 'mongoose';
import { Contact } from './models/Contact';
import { Conversation } from './models/Conversation';
import { Message } from './models/Message';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wab';

const dummyContacts = [
  { waId: '919876543210', phoneNumber: '+919876543210', profileName: 'Rahul Sharma', name: 'Rahul Sharma', tags: ['customer'] },
  { waId: '919988776655', phoneNumber: '+919988776655', profileName: 'Priya Patel', name: 'Priya Patel', tags: ['vip'] },
  { waId: '447911123456', phoneNumber: '+447911123456', profileName: 'James Wilson', name: 'James Wilson', tags: ['support'] },
  { waId: '14155551234', phoneNumber: '+14155551234', profileName: 'Sarah Johnson', name: 'Sarah Johnson', tags: ['lead'] },
  { waId: '971501234567', phoneNumber: '+971501234567', profileName: 'Ahmed Al-Rashid', name: 'Ahmed Al-Rashid', tags: ['customer', 'vip'] },
  { waId: '5511987654321', phoneNumber: '+5511987654321', profileName: 'Lucas Oliveira', name: 'Lucas Oliveira', tags: ['support'] },
  { waId: '33612345678', phoneNumber: '+33612345678', profileName: 'Marie Dupont', name: 'Marie Dupont', tags: ['lead'] },
  { waId: '81901234567', phoneNumber: '+81901234567', profileName: 'Yuki Tanaka', name: 'Yuki Tanaka', tags: ['customer'] },
  { waId: '61412345678', phoneNumber: '+61412345678', profileName: 'Emma Brown', name: 'Emma Brown', tags: [] },
  { waId: '27821234567', phoneNumber: '+27821234567', profileName: 'Thabo Mokoena', name: 'Thabo Mokoena', tags: ['customer'] },
];

const conversationMessages: { lastText: string; messages: { direction: 'inbound' | 'outbound'; body: string; minutesAgo: number }[] }[] = [
  {
    lastText: 'Sure, I will check and get back to you shortly.',
    messages: [
      { direction: 'inbound', body: 'Hi, I placed an order yesterday but haven\'t received any confirmation.', minutesAgo: 45 },
      { direction: 'outbound', body: 'Hello Rahul! Let me check your order status.', minutesAgo: 40 },
      { direction: 'outbound', body: 'I can see your order #4521 was placed successfully. The confirmation email was sent to your registered email.', minutesAgo: 38 },
      { direction: 'inbound', body: 'Oh I see, let me check my spam folder. Also, when will it be delivered?', minutesAgo: 35 },
      { direction: 'outbound', body: 'Sure, I will check and get back to you shortly.', minutesAgo: 30 },
    ],
  },
  {
    lastText: 'Thank you so much! You guys are the best!',
    messages: [
      { direction: 'inbound', body: 'Hey! I want to upgrade my plan to premium.', minutesAgo: 120 },
      { direction: 'outbound', body: 'Hi Priya! Great choice. The premium plan includes unlimited access and priority support.', minutesAgo: 115 },
      { direction: 'inbound', body: 'Sounds perfect. How do I upgrade?', minutesAgo: 110 },
      { direction: 'outbound', body: 'I\'ve sent you a payment link. Once completed, your account will be upgraded instantly.', minutesAgo: 105 },
      { direction: 'inbound', body: 'Done! Payment went through.', minutesAgo: 100 },
      { direction: 'outbound', body: 'Your account has been upgraded to Premium. Enjoy!', minutesAgo: 95 },
      { direction: 'inbound', body: 'Thank you so much! You guys are the best!', minutesAgo: 90 },
    ],
  },
  {
    lastText: 'I\'ll have the team look into this right away.',
    messages: [
      { direction: 'inbound', body: 'Hello, I\'m having trouble logging into my account. It says invalid credentials.', minutesAgo: 200 },
      { direction: 'outbound', body: 'Hi James, sorry to hear that. Have you tried resetting your password?', minutesAgo: 195 },
      { direction: 'inbound', body: 'Yes, I tried but the reset email never arrives.', minutesAgo: 190 },
      { direction: 'outbound', body: 'I\'ll have the team look into this right away.', minutesAgo: 185 },
    ],
  },
  {
    lastText: 'Can you send me the pricing details for the enterprise plan?',
    messages: [
      { direction: 'inbound', body: 'Hi there! I saw your product demo and I\'m very interested.', minutesAgo: 300 },
      { direction: 'outbound', body: 'Hello Sarah! Thank you for your interest. How can I help?', minutesAgo: 295 },
      { direction: 'inbound', body: 'Can you send me the pricing details for the enterprise plan?', minutesAgo: 290 },
    ],
  },
  {
    lastText: 'We will arrange the delivery for tomorrow between 10-12 AM.',
    messages: [
      { direction: 'inbound', body: 'Assalamu alaikum, I need to schedule a delivery for my order.', minutesAgo: 60 },
      { direction: 'outbound', body: 'Wa alaikum assalam Ahmed! Of course. What date and time works best for you?', minutesAgo: 55 },
      { direction: 'inbound', body: 'Tomorrow morning would be ideal, before noon if possible.', minutesAgo: 50 },
      { direction: 'outbound', body: 'We will arrange the delivery for tomorrow between 10-12 AM.', minutesAgo: 45 },
    ],
  },
  {
    lastText: 'Obrigado! Vou aguardar.',
    messages: [
      { direction: 'inbound', body: 'Oi! Preciso de ajuda com meu pedido.', minutesAgo: 400 },
      { direction: 'outbound', body: 'Olá Lucas! Claro, qual é o número do seu pedido?', minutesAgo: 395 },
      { direction: 'inbound', body: 'Pedido #7832. Está atrasado há 3 dias.', minutesAgo: 390 },
      { direction: 'outbound', body: 'Vou verificar com a transportadora e te retorno em breve.', minutesAgo: 385 },
      { direction: 'inbound', body: 'Obrigado! Vou aguardar.', minutesAgo: 380 },
    ],
  },
  {
    lastText: 'Merci beaucoup! À bientôt.',
    messages: [
      { direction: 'inbound', body: 'Bonjour! Je suis intéressée par vos services.', minutesAgo: 500 },
      { direction: 'outbound', body: 'Bonjour Marie! Avec plaisir. Que recherchez-vous exactement?', minutesAgo: 495 },
      { direction: 'inbound', body: 'Je voudrais un devis pour 50 utilisateurs.', minutesAgo: 490 },
      { direction: 'outbound', body: 'Je prépare le devis et vous l\'envoie par email dans l\'heure.', minutesAgo: 485 },
      { direction: 'inbound', body: 'Merci beaucoup! À bientôt.', minutesAgo: 480 },
    ],
  },
  {
    lastText: 'The product looks great! I want to place a bulk order.',
    messages: [
      { direction: 'inbound', body: 'Hello! I found your products on your website.', minutesAgo: 150 },
      { direction: 'outbound', body: 'Hi Yuki! Welcome! Which products caught your eye?', minutesAgo: 145 },
      { direction: 'inbound', body: 'The product looks great! I want to place a bulk order.', minutesAgo: 140 },
    ],
  },
  {
    lastText: 'No worries, take your time!',
    messages: [
      { direction: 'inbound', body: 'Hey, just following up on my refund request from last week.', minutesAgo: 1440 },
      { direction: 'outbound', body: 'Hi Emma! Let me check the status of your refund.', minutesAgo: 1435 },
      { direction: 'outbound', body: 'The refund is being processed and should reflect in 3-5 business days.', minutesAgo: 1430 },
      { direction: 'inbound', body: 'No worries, take your time!', minutesAgo: 1425 },
    ],
  },
  {
    lastText: 'I would like to know about your shipping rates to Cape Town.',
    messages: [
      { direction: 'inbound', body: 'Good day! Do you ship to South Africa?', minutesAgo: 2000 },
      { direction: 'outbound', body: 'Good day Thabo! Yes, we do ship internationally including South Africa.', minutesAgo: 1995 },
      { direction: 'inbound', body: 'I would like to know about your shipping rates to Cape Town.', minutesAgo: 1990 },
    ],
  },
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // Check if data already exists
  const existingContacts = await Contact.countDocuments();
  if (existingContacts > 0) {
    console.log(`Database already has ${existingContacts} contacts. Skipping seed.`);
    console.log('To re-seed, drop the collections first.');
    await mongoose.disconnect();
    return;
  }

  console.log('Seeding dummy data...');

  for (let i = 0; i < dummyContacts.length; i++) {
    const contactData = dummyContacts[i];
    const convData = conversationMessages[i];

    // Create contact
    const contact = await Contact.create(contactData);

    // Create conversation
    const now = new Date();
    const lastMsgTime = new Date(now.getTime() - convData.messages[convData.messages.length - 1].minutesAgo * 60000);
    const lastMsg = convData.messages[convData.messages.length - 1];

    const conversation = await Conversation.create({
      contact: contact._id,
      status: i < 5 ? 'open' : (i < 8 ? 'pending' : 'closed'),
      lastMessage: {
        text: convData.lastText,
        timestamp: lastMsgTime,
        direction: lastMsg.direction,
      },
      unreadCount: lastMsg.direction === 'inbound' ? Math.floor(Math.random() * 4) + 1 : 0,
      lastInboundAt: lastMsgTime,
      isWithinWindow: i < 6,
      tags: contactData.tags,
    });

    // Create messages
    for (const msg of convData.messages) {
      const msgTime = new Date(now.getTime() - msg.minutesAgo * 60000);
      await Message.create({
        conversation: conversation._id,
        contact: contact._id,
        direction: msg.direction,
        type: 'text',
        status: msg.direction === 'outbound' ? 'delivered' : 'read',
        text: { body: msg.body },
        timestamp: msgTime,
      });
    }

    console.log(`  Created: ${contactData.name} with ${convData.messages.length} messages`);
  }

  console.log('\nDummy data seeded successfully!');
  console.log('  - 10 contacts');
  console.log('  - 10 conversations');
  console.log('  - Multiple messages per conversation');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
