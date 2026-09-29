import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Factory, Droplet, Hammer, Bird, Hexagon, MoreHorizontal } from "lucide-react";

export type SurveyCategory = "textile" | "beverage" | "steel" | "hatchery" | "sugar" | "other";

interface CategoryOption {
  id: SurveyCategory;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const SURVEY_CATEGORIES: CategoryOption[] = [
  {
    id: "textile",
    name: "Textile",
    description: "Textile mill survey with spinning unit and blow room assessment",
    icon: <Factory className="h-12 w-12" />,
    color: "from-blue-50 to-blue-100",
  },
  {
    id: "beverage",
    name: "Beverage",
    description: "Beverage manufacturing facility survey",
    icon: <Droplet className="h-12 w-12" />,
    color: "from-green-50 to-green-100",
  },
  {
    id: "steel",
    name: "Steel Mill",
    description: "Steel mill operations survey",
    icon: <Hammer className="h-12 w-12" />,
    color: "from-gray-50 to-gray-100",
  },
  {
    id: "hatchery",
    name: "Hatchery",
    description: "Hatchery facility survey",
    icon: <Bird className="h-12 w-12" />,
    color: "from-yellow-50 to-yellow-100",
  },
  {
    id: "sugar",
    name: "Sugar",
    description: "Sugar processing facility survey",
    icon: <Hexagon className="h-12 w-12" />,
    color: "from-amber-50 to-amber-100",
  },
  {
    id: "other",
    name: "Other Categories",
    description: "Custom survey for other industries (coming soon)",
    icon: <MoreHorizontal className="h-12 w-12" />,
    color: "from-purple-50 to-purple-100",
  },
];

export default function SurveyReportCategorySelect() {
  const navigate = useNavigate();

  const handleSelectCategory = (categoryId: SurveyCategory) => {
    if (categoryId === "other") {
      alert("Custom templates coming soon!");
      return;
    }
    navigate(`/survey-reports/new/${categoryId}`);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-4 sm:p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/survey-reports")}
            className="hover:bg-white/20 h-9 w-9 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold">Create Survey Report</h1>
        <p className="text-blue-100 mt-2 text-sm sm:text-base">
          Select a report category to begin
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {SURVEY_CATEGORIES.map((category) => (
            <Card
              key={category.id}
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-blue-400 ${
                category.id === "other" ? "opacity-60" : ""
              }`}
              onClick={() => handleSelectCategory(category.id)}
            >
              <CardContent className="pt-6 sm:pt-8">
                <div className={`bg-gradient-to-br ${category.color} rounded-lg p-4 sm:p-6 mb-4 flex justify-center`}>
                  <div className="text-slate-600">{category.icon}</div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
                  {category.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-4 line-clamp-2">
                  {category.description}
                </p>

                <Button
                  className={`w-full ${
                    category.id === "other"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                  disabled={category.id === "other"}
                >
                  {category.id === "other" ? "Coming Soon" : "Create Report"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
}
