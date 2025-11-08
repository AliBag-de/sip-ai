export enum OpenAIRealtimeEventType {
    // Conversation /Input Audio
    ConversationItemInputAudioTranscriptionCompleted = "conversation.item.input_audio_transcription.completed",
    ConversationItemInputAudioTranscriptionDelta='conversation.item.input_audio_transcription.delta',
    ConversationItemCreated = "conversation.item.created",
    ConversationItemTruncated = "conversation.item.truncated",
    ConversationItemDeleted = "conversation.item.deleted",
    //Reponse lifecycle
    ResponseAudioTranscriptDone= 'response.audio_transcript.done',
    
    ResponseCreated = "response.created",
    ResponseTextDelta = "response.text.delta",
    ResponseTextDone = "response.text.done",
    ResponseAudioDelta = "response.audio.delta",
    ResponseAudioDone = "response.audio.done",
    ResponseDone = "response.done",
    ResponseError = "response.error",
    ResponseFailed = "response.failed",

    //   Other real-time events
    SessionCreated = "session.created",
    SessionUpdated = "session.updated",
    InputAudioBufferCommitted = "input_audio_buffer.committed",
    InputAudioBufferCleared = "input_audio_buffer.cleared",
    InputAudioBufferAppended = "input_audio_buffer.appended",

    // Generl error/ debug
    Error = "error",
    Log = "log",
}
