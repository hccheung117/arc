export default function Composer() {
  return (
    <div className="flex h-full px-[var(--content-px)] pt-0 pb-4">
      <div className="bg-muted flex w-full flex-col rounded-lg p-4">
        <textarea
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Type a message..."
        />
      </div>
    </div>
  )
}
