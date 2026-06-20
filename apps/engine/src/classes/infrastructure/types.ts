type ReplyAddress =
  | {
      redisQueueId: string;
    }
  | {
      redisStreamId: string;
    };

export type { ReplyAddress };
