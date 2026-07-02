const SuggestedTopics: React.FC = () => {
  const topics = [
    { icon: '🏅', text: '2024年夏季奥运会' },
    { icon: '🚲', text: '自行车道最多的城市' },
    // Add more topics here
  ]

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {topics.map((topic, index) => (
        <div key={index} className="bg-gray-800 p-4 rounded-lg">
          <span className="mr-2">{topic.icon}</span>
          {topic.text}
        </div>
      ))}
    </div>
  )
}

export default SuggestedTopics