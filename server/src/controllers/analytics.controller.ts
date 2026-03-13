import { Response } from 'express';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';

export const analyticsController = {
  async messageStats(req: AuthRequest, res: Response) {
    try {
      const { from, to } = req.query;
      const dateFilter: any = {};
      if (from) dateFilter.$gte = new Date(from as string);
      if (to) dateFilter.$lte = new Date(to as string);

      const match: any = {};
      if (Object.keys(dateFilter).length) match.timestamp = dateFilter;

      const [totals, daily] = await Promise.all([
        Message.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$direction',
              count: { $sum: 1 },
            },
          },
        ]),
        Message.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                direction: '$direction',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ]),
      ]);

      const inbound = totals.find((t) => t._id === 'inbound')?.count || 0;
      const outbound = totals.find((t) => t._id === 'outbound')?.count || 0;

      // Group daily data
      const dailyMap: Record<string, { date: string; inbound: number; outbound: number }> = {};
      for (const d of daily) {
        if (!dailyMap[d._id.date]) {
          dailyMap[d._id.date] = { date: d._id.date, inbound: 0, outbound: 0 };
        }
        dailyMap[d._id.date][d._id.direction as 'inbound' | 'outbound'] = d.count;
      }

      res.json({
        total: inbound + outbound,
        inbound,
        outbound,
        daily: Object.values(dailyMap),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async conversationStats(req: AuthRequest, res: Response) {
    try {
      const statusCounts = await Conversation.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
      const byStatus: Record<string, number> = {};
      for (const s of statusCounts) {
        byStatus[s._id] = s.count;
      }

      res.json({ total, byStatus });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async responseTimeStats(req: AuthRequest, res: Response) {
    try {
      const { from, to } = req.query;
      const dateFilter: any = {};
      if (from) dateFilter.$gte = new Date(from as string);
      if (to) dateFilter.$lte = new Date(to as string);

      const match: any = { direction: 'outbound' };
      if (Object.keys(dateFilter).length) match.timestamp = dateFilter;

      // Get conversations that have both inbound and outbound messages
      const results = await Message.aggregate([
        { $match: match },
        { $sort: { conversation: 1, timestamp: 1 } },
        {
          $lookup: {
            from: 'messages',
            let: { convId: '$conversation', outTime: '$timestamp' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$conversation', '$$convId'] },
                      { $eq: ['$direction', 'inbound'] },
                      { $lt: ['$timestamp', '$$outTime'] },
                    ],
                  },
                },
              },
              { $sort: { timestamp: -1 } },
              { $limit: 1 },
            ],
            as: 'lastInbound',
          },
        },
        { $unwind: '$lastInbound' },
        {
          $project: {
            responseTime: {
              $subtract: ['$timestamp', '$lastInbound.timestamp'],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            minResponseTime: { $min: '$responseTime' },
            maxResponseTime: { $max: '$responseTime' },
            count: { $sum: 1 },
          },
        },
      ]);

      const stats = results[0] || { avgResponseTime: 0, minResponseTime: 0, maxResponseTime: 0, count: 0 };

      res.json({
        avgResponseTimeMs: Math.round(stats.avgResponseTime || 0),
        avgResponseTimeMins: Math.round((stats.avgResponseTime || 0) / 60000),
        minResponseTimeMs: stats.minResponseTime || 0,
        maxResponseTimeMs: stats.maxResponseTime || 0,
        totalResponses: stats.count,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async agentPerformance(req: AuthRequest, res: Response) {
    try {
      const agents = await User.find({ role: { $in: ['admin', 'agent'] } }).select('-password');

      const performance = await Promise.all(
        agents.map(async (agent) => {
          const [messageCount, assignedCount, resolvedCount] = await Promise.all([
            Message.countDocuments({ sentBy: agent._id, direction: 'outbound' }),
            Conversation.countDocuments({ assignedTo: agent._id, status: 'open' }),
            Conversation.countDocuments({ assignedTo: agent._id, status: 'closed' }),
          ]);

          return {
            agent: { _id: agent._id, name: agent.name, email: agent.email, isOnline: agent.isOnline },
            messagesSent: messageCount,
            activeConversations: assignedCount,
            resolvedConversations: resolvedCount,
          };
        })
      );

      res.json(performance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
